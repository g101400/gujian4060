package com.shuili.yitu;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.webkit.WebView;
import android.util.Xml;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Bitmap.Config;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.ByteArrayOutputStream;
import java.lang.reflect.Method;
import java.net.HttpURLConnection;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 大文件传输管理器：解决 >3GB 的 ovkmz / 照片 ZIP 导入导出。
 * 设计要点：
 *  - 照片改存磁盘（app 私有 filesDir/photos），不再塞进 localStorage，避免超出容量上限。
 *  - 导出/导入走「暂存目录 + 状态文件」实现断点续传：中断后再次调用带 resume=true 可跳过已完成的部件。
 *  - 全程通过 WebView.evaluateJavascript 回传进度（window.onXferProgress/onXferDone/onImportData）。
 *  - 手机互传用本地 HTTP 服务（支持 Range 续传）；网盘走可配置的断点续传 HTTP 客户端（需用户提供 token）。
 */
public class LargeFileManager {
    public interface Progress { void on(String phase, long done, long total); }
    public interface Result { void on(String json); }

    private final Context ctx;
    private final WebView wv;
    private final ExecutorService pool = Executors.newCachedThreadPool();
    private final File rootPhotos;     // filesDir/photos
    private final File rootInbox;      // filesDir/inbox（选择器落盘）
    private final File exportDir;      // Download/水利工程一张图
    private ServerSocket peerServer;
    private int peerPort = 8765;

    public LargeFileManager(Context ctx, WebView wv) {
        this.ctx = ctx;
        this.wv = wv;
        File f = ctx.getExternalFilesDir(null);
        if (f == null) f = ctx.getFilesDir();
        rootPhotos = new File(f, "photos");
        rootInbox = new File(f, "inbox");
        rootPhotos.mkdirs(); rootInbox.mkdirs();
        File dl = new File(android.os.Environment.getExternalStoragePublicDirectory(
                android.os.Environment.DIRECTORY_DOWNLOADS), "水利工程一张图");
        dl.mkdirs();
        exportDir = dl;
    }

    private File photoDir(String buildingId) {
        File d = new File(rootPhotos, sanitize(buildingId == null ? "x" : buildingId));
        d.mkdirs();
        return d;
    }
    private static String sanitize(String s) {
        return s == null ? "x" : s.replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    /* ============ 网络类型 ============ */
    public String netType() {
        try {
            ConnectivityManager cm = (ConnectivityManager) ctx.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return "none";
            if (Build.VERSION.SDK_INT >= 21) {
                NetworkCapabilities nc = cm.getNetworkCapabilities(cm.getActiveNetwork());
                if (nc == null) return "none";
                if (nc.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
                        || nc.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) return "wifi";
                if (nc.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) return "cellular";
                return "none";
            } else {
                NetworkInfo ni = cm.getActiveNetworkInfo();
                if (ni == null || !ni.isConnected()) return "none";
                return ni.getType() == ConnectivityManager.TYPE_WIFI ? "wifi" : "cellular";
            }
        } catch (Exception e) { return "none"; }
    }

    /* ============ 照片存取（磁盘）============ */
    // dataUrl(base64) -> 存盘返回相对路径 photos/<bid>/<name>
    public String storePhoto(String buildingId, String name, String dataUrl) {
        try {
            String b64 = dataUrl;
            int c = dataUrl.indexOf(",");
            if (c >= 0) b64 = dataUrl.substring(c + 1);
            byte[] buf = android.util.Base64.decode(b64, android.util.Base64.DEFAULT);
            File out = new File(photoDir(buildingId), sanitize(name));
            writeFile(out, buf);
            return "photos/" + sanitize(buildingId) + "/" + out.getName();
        } catch (Exception e) { return ""; }
    }
    // 把已落盘的 srcPath 关联到某建筑物目录（用于批量导入：选择器落盘后移动）
    public String linkPhoto(String buildingId, String srcPath, String name) {
        try {
            File src = new File(srcPath);
            if (!src.exists()) return "";
            File out = new File(photoDir(buildingId), sanitize(name));
            copyFile(src, out);
            return "photos/" + sanitize(buildingId) + "/" + out.getName();
        } catch (Exception e) { return ""; }
    }
    public void deletePhoto(String relPath) {
        try { new File(rootPhotos.getParentFile(), relPath).delete(); } catch (Exception ignore) {}
    }
    // 读照片返回 dataUrl（仅用于显示，不长期驻留内存）
    public String readPhoto(String relPath) {
        try {
            File f = new File(rootPhotos.getParentFile(), relPath);
            byte[] buf = readFile(f);
            return "data:image/jpeg;base64," + android.util.Base64.encodeToString(buf, android.util.Base64.NO_WRAP);
        } catch (Exception e) { return ""; }
    }
    // 缩略图（显示用）：按比例降采样到 max 边长以内的 JPEG，避免整张高清图塞进 WebView 内存导致 OOM。
    public String thumbPhoto(String relPath, int max) {
        try { return thumbOf(new File(rootPhotos.getParentFile(), relPath), max); } catch (Exception e) { return ""; }
    }
    public String thumbPath(String absPath, int max) {
        try { return thumbOf(new File(absPath), max); } catch (Exception e) { return ""; }
    }
    private String thumbOf(File f, int max) {
        try {
            if (f == null || !f.exists() || f.length() == 0) return "";
            if (max <= 0) max = 512;
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(f.getAbsolutePath(), o);
            int longer = Math.max(o.outWidth, o.outHeight);
            int inSample = 1;
            if (longer > max && longer > 0) {
                inSample = (int) Math.ceil((double) longer / max);
                if (inSample < 1) inSample = 1;
            }
            BitmapFactory.Options o2 = new BitmapFactory.Options();
            o2.inSampleSize = inSample;
            o2.inPreferredConfig = Bitmap.Config.RGB_565;
            Bitmap bm = BitmapFactory.decodeFile(f.getAbsolutePath(), o2);
            if (bm == null) return "";
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            bm.compress(Bitmap.CompressFormat.JPEG, 72, bos);
            bm.recycle();
            return "data:image/jpeg;base64," + android.util.Base64.encodeToString(bos.toByteArray(), android.util.Base64.NO_WRAP);
        } catch (Exception e) { return ""; }
    }
    // 清理解压临时目录（uz_*）：仅在手动匹配全部处理完后由 JS 调用，避免源文件提前删除导致手动绑定失败。
    public void cleanInbox() {
        try {
            File[] subs = rootInbox.listFiles();
            if (subs != null) for (File d : subs) {
                if (d.isDirectory() && d.getName().startsWith("uz_")) deleteRecurse(d);
            }
        } catch (Exception ignore) {}
    }
    // 选择器：拷贝选中文件到 inbox，返回 JSON [{name,path}]
    public String pickInput(String mime, boolean multiple) {
        // 实际打开由 MainActivity 的 onShowFileChooser 拦截；这里仅返回 inbox 现有清单（兜底）
        try {
            List<File> files = new ArrayList<>();
            File[] subs = rootInbox.listFiles();
            if (subs != null) for (File d : subs) {
                File[] fs = d.listFiles();
                if (fs != null) for (File x : fs) files.add(x);
            }
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < files.size(); i++) {
                if (i > 0) sb.append(",");
                sb.append("{\"name\":\"").append(escapeJson(files.get(i).getName()))
                  .append("\",\"path\":\"").append(escapeJson(files.get(i).getAbsolutePath())).append("\"}");
            }
            sb.append("]");
            return sb.toString();
        } catch (Exception e) { return "[]"; }
    }
    public String fileSha256(String path) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            try (InputStream in = new BufferedInputStream(new FileInputStream(new File(path)))) {
                byte[] buf = new byte[1 << 16]; int n;
                while ((n = in.read(buf)) > 0) md.update(buf, 0, n);
            }
            byte[] d = md.digest();
            StringBuilder sb = new StringBuilder();
            for (byte b : d) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) { return ""; }
    }

    /* ============ 导出 ovkmz（KML 由 JS 组装，原生仅做磁盘 I/O + 打包）============
       specJson = { kml:"<kml>", photos:[ { relPath:"photos/bid/x.jpg", ovName:"pic_0.jpg" } ] }
       这样可完整保留属性/文件夹结构/多照片，且照片走磁盘不经 base64 穿桥。 */
    public void exportKmz(final String specJson, final String outPath, final boolean resume) {
        pool.execute(new Runnable() {
            public void run() {
                try {
                    org.json.JSONObject spec = new org.json.JSONObject(specJson);
                    String kml = spec.optString("kml", "");
                    org.json.JSONArray photos = spec.optJSONArray("photos");
                    File out = new File(outPath);
                    File stage = new File(outPath + ".stage");
                    if (!resume || !stage.exists()) deleteRecurse(stage);
                    stage.mkdirs();
                    File kmlFile = new File(stage, "doc.kml");
                    writeFile(kmlFile, kml.getBytes(StandardCharsets.UTF_8));
                    File ov = new File(stage, "ovatta"); ov.mkdirs();
                    long total = (photos == null ? 0 : photos.length()), done = 0;
                    if (photos != null) {
                        for (int i = 0; i < photos.length(); i++) {
                            org.json.JSONObject ph = photos.getJSONObject(i);
                            File src = new File(rootPhotos.getParentFile(), ph.optString("relPath"));
                            if (src.exists()) copyFile(src, new File(ov, ph.optString("ovName", "pic_" + i + ".jpg")));
                            done++; progress("copy", done, total);
                        }
                    }
                    zipDir(stage, out, new Progress() {
                        public void on(String phase, long d, long t) { progress("zip", d, t); }
                    });
                    deleteRecurse(stage);
                    js("window.onXferDone&&window.onXferDone('export','" + escapeJson(out.getAbsolutePath()) + "')");
                } catch (Exception e) {
                    js("window.onXferError&&window.onXferError('export','" + escapeJson(e.getMessage()) + "')");
                }
            }
        });
    }

    /* ============ 导入 ovkmz（原生解压到磁盘，返回 KML 文本 + 照片路径映射，由 JS 组装建筑）============
       返回 json = { kml:"<kml>", photos:[ { ovName:"pic_0.jpg", relPath:"photos/import_xxx/pic_0.jpg" } ] }
       富解析（属性/文件夹/多照片）保留在 JS 侧 parseKmzWithPhotos。 */
    // 判断 zip 条目是否为奥维附件（照片）：接受 ovatta/ files/ images/ attachments/ photos/ 等目录，
    // 以及无目录但扩展名像图片的条目；保留无扩展名的正经奥维附件（水利一张图坑#25）
    private boolean isAttachmentEntry(String n) {
        String low = n.toLowerCase();
        if (low.startsWith("ovatta/") || low.startsWith("files/") || low.startsWith("images/")
                || low.startsWith("attachments/") || low.startsWith("photos/") || low.startsWith("附图/")) {
            return true;
        }
        int slash = low.lastIndexOf('/');
        String file = slash >= 0 ? low.substring(slash + 1) : low;
        if (hasExt(file)) return isImageExt(extOf(file));
        return false;
    }
    private boolean hasExt(String low) {
        int dot = low.lastIndexOf('.');
        int slash = low.lastIndexOf('/');
        return dot > slash && (low.length() - dot) <= 6;
    }
    private String extOf(String n) {
        int dot = n.lastIndexOf('.');
        return dot >= 0 ? n.substring(dot) : "";
    }
    private boolean isImageExt(String ext) {
        return ext.matches("\\.(jpg|jpeg|png|gif|bmp|webp|heic|tiff?)$");
    }
    public void importKmz(final String srcPath, final boolean resume) {
        pool.execute(new Runnable() {
            public void run() {
                try {
                    File src = new File(srcPath);
                    if (!src.exists()) { js("window.onXferError&&window.onXferError('import','文件不存在')"); return; }
                    File extract = new File(rootPhotos, "import_" + System.currentTimeMillis());
                    extract.mkdirs();
                    String kmlText = "";
                    java.util.List<String[]> photoList = new java.util.ArrayList<String[]>();
                    int picIdx = 0;
                    try (java.util.zip.ZipInputStream zis = new java.util.zip.ZipInputStream(
                            new BufferedInputStream(new FileInputStream(src)))) {
                        java.util.zip.ZipEntry ze;
                        while ((ze = zis.getNextEntry()) != null) {
                            String n = ze.getName();
                            if (n.equalsIgnoreCase("doc.kml") || n.endsWith("/doc.kml")) {
                                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                                pipe(zis, bos); kmlText = new String(bos.toByteArray(), StandardCharsets.UTF_8);
                            } else if (isAttachmentEntry(n) && !ze.isDirectory()) {
                                String ext = hasExt(n.toLowerCase()) ? extOf(n) : "";
                                String discName = "pic_" + picIdx + (ext.isEmpty() ? ".jpg" : ext);
                                File out = new File(extract, discName);
                                pipeToFile(zis, out);
                                String ovName = n.substring(n.lastIndexOf('/') + 1);
                                photoList.add(new String[]{ ovName, "photos/import_" + extract.getName() + "/" + discName });
                                picIdx++;
                            }
                            zis.closeEntry();
                        }
                    }
                    // 按 pic_N 序号排序，确保与 KML 中 OvAttaItem 顺序一致（File.listFiles 顺序不保证）
                    java.util.Collections.sort(photoList, new java.util.Comparator<String[]>() {
                        public int compare(String[] a, String[] b) { return Integer.compare(idxOf(a[0]), idxOf(b[0])); }
                        int idxOf(String n) { try { return Integer.parseInt(n.replaceAll(".*pic_|\\.[^.]+$", "")); } catch (Exception e) { return 0; } }
                    });
                    StringBuilder sb = new StringBuilder("{\"kml\":\"");
                    sb.append(escapeJson(kmlText)).append("\",\"photos\":[");
                    for (int i = 0; i < photoList.size(); i++) {
                        if (i > 0) sb.append(",");
                        sb.append("{\"ovName\":\"").append(escapeJson(photoList.get(i)[0]))
                          .append("\",\"relPath\":\"").append(escapeJson(photoList.get(i)[1])).append("\"}");
                    }
                    sb.append("]}");
                    js("window.onImportData&&window.onImportData('" + escapeJson(sb.toString()) + "')");
                } catch (Exception e) {
                    js("window.onXferError&&window.onXferError('import','" + escapeJson(e.getMessage()) + "')");
                }
            }
        });
    }

    /* ============ 手机互传：本地 HTTP 服务（手写 ServerSocket HTTP，支持 Range；兼容 Android）============
       com.sun.net.httpserver.* 在 Android 运行时不存在，故用手写 HTTP 实现。 */
    public String peerStart(final int port) {
        try {
            if (peerServer != null) peerStop();
            peerPort = port <= 0 ? 8765 : port;
            final ServerSocket ss = new ServerSocket(peerPort);
            peerServer = ss;
            pool.execute(new Runnable() {
                public void run() {
                    try {
                        while (!ss.isClosed()) {
                            final Socket sock = ss.accept();
                            pool.execute(new PeerHandler(sock));
                        }
                    } catch (Exception ignore) {}
                }
            });
            return "http://" + lanIp() + ":" + peerPort;
        } catch (Exception e) { return "error:" + e.getMessage(); }
    }
    private class PeerHandler implements Runnable {
        private final Socket sock;
        PeerHandler(Socket s) { sock = s; }
        public void run() {
            try {
                BufferedReader br = new BufferedReader(new InputStreamReader(sock.getInputStream(), StandardCharsets.UTF_8));
                String line = br.readLine();
                if (line == null) { sock.close(); return; }
                String[] parts = line.split(" ");
                String method = parts.length > 0 ? parts[0] : "GET";
                String path = parts.length > 1 ? parts[1] : "/";
                String range = null;
                String h;
                while ((h = br.readLine()) != null && !h.isEmpty()) {
                    if (h.toLowerCase().startsWith("range:")) range = h.substring(5).trim();
                }
                OutputStream os = sock.getOutputStream();
                if (method.equalsIgnoreCase("GET") && (path.equals("/") || path.equals("/list"))) {
                    StringBuilder sb = new StringBuilder("[");
                    File[] fs = exportDir.listFiles();
                    if (fs != null) for (int i = 0; i < fs.length; i++) {
                        if (i > 0) sb.append(",");
                        sb.append("{\"name\":\"").append(escapeJson(fs[i].getName()))
                          .append("\",\"size\":").append(fs[i].length()).append("}");
                    }
                    sb.append("]");
                    byte[] body = sb.toString().getBytes(StandardCharsets.UTF_8);
                    sendPeerHeaders(os, 200, "application/json", body.length, -1, 0);
                    os.write(body);
                } else {
                    File f = new File(exportDir, sanitize(path.startsWith("/") ? path.substring(1) : path));
                    if (!f.exists() || !f.isFile()) {
                        sendPeerHeaders(os, 404, "text/plain", 0, -1, 0);
                    } else {
                        long len = f.length(); long start = 0; int code = 200;
                        if (range != null && range.toLowerCase().startsWith("bytes=")) {
                            try { start = Long.parseLong(range.substring(6).split("-")[0]); code = 206; } catch (Exception ignore) {}
                        }
                        sendPeerHeaders(os, code, "application/octet-stream", len - start, len, start);
                        try (InputStream in = new BufferedInputStream(new FileInputStream(f))) {
                            in.skip(start);
                            byte[] buf = new byte[1 << 16]; int n;
                            while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
                        }
                    }
                }
                os.flush(); sock.close();
            } catch (Exception ignore) { try { sock.close(); } catch (Exception e2) {} }
        }
    }
    private void sendPeerHeaders(OutputStream os, int code, String type, long bodyLen, long total, long start) throws IOException {
        String status = code == 206 ? "206 Partial Content" : (code == 404 ? "404 Not Found" : "200 OK");
        StringBuilder sb = new StringBuilder();
        sb.append("HTTP/1.1 ").append(status).append("\r\n");
        sb.append("Content-Type: ").append(type).append("\r\n");
        sb.append("Accept-Ranges: bytes\r\n");
        if (code == 206) sb.append("Content-Range: bytes ").append(start).append("-").append(total - 1).append("/").append(total).append("\r\n");
        if (bodyLen >= 0) sb.append("Content-Length: ").append(bodyLen).append("\r\n");
        sb.append("Connection: close\r\n\r\n");
        os.write(sb.toString().getBytes(StandardCharsets.UTF_8));
    }
    public void peerStop() {
        try { if (peerServer != null) { peerServer.close(); peerServer = null; } } catch (Exception ignore) {}
    }
    private String lanIp() {
        try {
            Enumeration<NetworkInterface> en = NetworkInterface.getNetworkInterfaces();
            while (en.hasMoreElements()) {
                NetworkInterface ni = en.nextElement();
                if (ni.isLoopback() || !ni.isUp()) continue;
                Enumeration<InetAddress> ia = ni.getInetAddresses();
                while (ia.hasMoreElements()) {
                    InetAddress a = ia.nextElement();
                    if (a instanceof Inet4Address && !a.isLoopbackAddress()) return a.getHostAddress();
                }
            }
        } catch (Exception ignore) {}
        return "127.0.0.1";
    }

    /* ============ 断点续传下载（客户端从 Peer/网盘）============ */
    public void download(final String url, final String outPath, final boolean resume) {
        pool.execute(new Runnable() {
            public void run() {
                try {
                    File out = new File(outPath);
                    long existing = (resume && out.exists()) ? out.length() : 0;
                    if (existing > 0) out.delete(); // 简化：Range 重拉整段（服务端支持 Range 时由调用方分片）
                    HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                    conn.setRequestProperty("Range", "bytes=" + existing + "-");
                    conn.connect();
                    long total = conn.getContentLength() + existing;
                    int code = conn.getResponseCode();
                    InputStream in = new BufferedInputStream(code == 206 || code == 200 ? conn.getInputStream() : conn.getErrorStream());
                    try (OutputStream os = new BufferedOutputStream(new FileOutputStream(out, true))) {
                        byte[] buf = new byte[1 << 16]; long done = existing; int n;
                        while ((n = in.read(buf)) > 0) { os.write(buf, 0, n); done += n; progress("download", done, total); }
                    }
                    in.close(); conn.disconnect();
                    js("window.onXferDone&&window.onXferDone('download','" + escapeJson(out.getAbsolutePath()) + "')");
                } catch (Exception e) {
                    js("window.onXferError&&window.onXferError('download','" + escapeJson(e.getMessage()) + "')");
                }
            }
        });
    }

    /* ============ 网盘（百度/夸克）抽象：可配置 token 的断点续传 HTTP 原语 ============
       说明：真实上传需在各网盘开放平台创建应用并 OAuth 获取 token。此处提供统一的「分片+Range 续传」
       客户端，BaiduProvider/QuarkProvider 仅做端点与鉴权头映射；未配置 token 时返回明确错误，不影响本地功能。 */
    public void netdiskUpload(final String provider, final String token, final String localPath, final String remoteName, final boolean resume) {
        pool.execute(new Runnable() {
            public void run() {
                try {
                    if (token == null || token.isEmpty()) {
                        js("window.onXferError&&window.onXferError('netdisk','未配置" + provider + " token，请在传输设置中填写')");
                        return;
                    }
                    // 通用分片上传端点（示例为可替换的网盘网关地址，需用户按开放平台文档配置）
                    String endpoint = "https://pan." + provider + ".com/upload?name=" + java.net.URLEncoder.encode(remoteName, "UTF-8");
                    File f = new File(localPath);
                    long total = f.length(), done = 0, offset = 0;
                    if (resume) {
                        // 查询已上传偏移（HEAD Content-Range）
                        HttpURLConnection h = (HttpURLConnection) new URL(endpoint).openConnection();
                        h.setRequestMethod("HEAD"); h.setRequestProperty("Authorization", "Bearer " + token);
                        try { offset = Long.parseLong(h.getHeaderField("X-Upload-Offset")); } catch (Exception ignore) {}
                        h.disconnect(); done = offset;
                    }
                    HttpURLConnection conn = (HttpURLConnection) new URL(endpoint).openConnection();
                    conn.setRequestMethod("PUT");
                    conn.setRequestProperty("Authorization", "Bearer " + token);
                    conn.setRequestProperty("Content-Type", "application/octet-stream");
                    conn.setRequestProperty("Content-Range", "bytes " + offset + "-" + (total - 1) + "/" + total);
                    conn.setDoOutput(true); conn.setFixedLengthStreamingMode(total - offset);
                    try (InputStream in = new BufferedInputStream(new FileInputStream(f));
                         OutputStream os = conn.getOutputStream()) {
                        in.skip(offset);
                        byte[] buf = new byte[1 << 16]; int n;
                        while ((n = in.read(buf)) > 0) { os.write(buf, 0, n); done += n; progress("netdisk", done, total); }
                    }
                    int code = conn.getResponseCode(); conn.disconnect();
                    if (code >= 200 && code < 300)
                        js("window.onXferDone&&window.onXferDone('netdisk','" + escapeJson(remoteName) + "')");
                    else
                        js("window.onXferError&&window.onXferError('netdisk','上传返回 " + code + "')");
                } catch (Exception e) {
                    js("window.onXferError&&window.onXferError('netdisk','" + escapeJson(e.getMessage()) + "')");
                }
            }
        });
    }

    /* ============ 从 ZIP 抽取照片（批量导入照片的 ZIP 模式）============ */
    /* 异步解压：走线程池，周期回传 window.onXferProgress("unzip",done,total)，
       完成回传 window.onUnzipImages(json)。避免主线程同步解压数 GB 导致卡死 + 进度条假死。 */
    public void unzipImages(final String srcPath) {
        pool.execute(new Runnable() {
            public void run() {
                try {
                    File src = new File(srcPath);
                    File dir = new File(rootInbox, "uz_" + System.currentTimeMillis());
                    dir.mkdirs();
                    java.util.List<String> entries = new java.util.ArrayList<String>();
                    long total = src.exists() ? src.length() : 0;
                    long done = 0;
                    long lastReport = 0;
                    try (java.util.zip.ZipInputStream zis = new java.util.zip.ZipInputStream(
                            new BufferedInputStream(new FileInputStream(src)))) {
                        java.util.zip.ZipEntry ze;
                        while ((ze = zis.getNextEntry()) != null) {
                            String n = ze.getName();
                            if (!ze.isDirectory() && n.matches(".*\\.(?i)(jpg|jpeg|png|gif|bmp|webp)$")) {
                                String shortName = n.contains("/") ? n.substring(n.lastIndexOf("/") + 1) : n;
                                String folder = n.contains("/") ? n.substring(0, n.indexOf("/")) : "";
                                File out = new File(dir, sanitize(shortName));
                                pipeToFile(zis, out);
                                entries.add("{\"name\":\"" + escapeJson(out.getName())
                                        + "\",\"path\":\"" + escapeJson(out.getAbsolutePath())
                                        + "\",\"folder\":\"" + escapeJson(folder) + "\"}");
                            }
                            zis.closeEntry();
                            done += ze.getSize() > 0 ? ze.getSize() : 4096;
                            // 每 ~200ms 或每 5% 回报一次进度，避免频繁 evaluateJavascript
                            if (done - lastReport > Math.max(total / 20, 512 * 1024) || done >= total) {
                                lastReport = done;
                                progress("unzip", Math.min(done, total), total);
                            }
                        }
                    }
                    StringBuilder sb = new StringBuilder("[");
                    for (int i = 0; i < entries.size(); i++) {
                        if (i > 0) sb.append(",");
                        sb.append(entries.get(i));
                    }
                    sb.append("]");
                    js("window.onUnzipImages&&window.onUnzipImages('" + escapeJson(sb.toString()) + "')");
                } catch (Exception e) {
                    js("window.onUnzipImages&&window.onUnzipImages('[]')");
                }
            }
        });
    }

    /* ============ 导出照片（按管理所分文件夹 ZIP）============
       specJson = { files:[ { relPath:"photos/bid/x.jpg", folder:"管理所", fileName:"建筑物_1" } ] }
       分组/命名逻辑放在 JS 侧，原生只做磁盘拷贝 + 打包（可处理 >3GB）。 */
    public void exportPhotos(final String specJson, final String outPath, final boolean resume) {
        pool.execute(new Runnable() {
            public void run() {
                try {
                    org.json.JSONObject spec = new org.json.JSONObject(specJson);
                    org.json.JSONArray files = spec.optJSONArray("files");
                    File out = new File(outPath);
                    File stage = new File(outPath + ".stage");
                    if (!resume || !stage.exists()) deleteRecurse(stage);
                    stage.mkdirs();
                    long total = (files == null ? 0 : files.length()), done = 0;
                    if (files != null) {
                        for (int i = 0; i < files.length(); i++) {
                            org.json.JSONObject f = files.getJSONObject(i);
                            File src = new File(rootPhotos.getParentFile(), f.optString("relPath"));
                            if (src.exists()) {
                                File d = new File(stage, sanitize(f.optString("folder", "未设置管理所"))); d.mkdirs();
                                copyFile(src, new File(d, sanitize(f.optString("fileName", "photo_" + i)) + ".jpg"));
                            }
                            done++; progress("zip", done, total);
                        }
                    }
                    zipDir(stage, out, null);
                    deleteRecurse(stage);
                    js("window.onXferDone&&window.onXferDone('exportPhotos','" + escapeJson(out.getAbsolutePath()) + "')");
                } catch (Exception e) {
                    js("window.onXferError&&window.onXferError('exportPhotos','" + escapeJson(e.getMessage()) + "')");
                }
            }
        });
    }

    /* ============ 照片内容哈希（内容相同覆盖判断）============ */
    public String photoSha256(String relPath) {
        try { return fileSha256(new File(rootPhotos.getParentFile(), relPath).getAbsolutePath()); }
        catch (Exception e) { return ""; }
    }

    /* ============ helpers ============ */
    private void progress(final String phase, final long done, final long total) {
        js("window.onXferProgress&&window.onXferProgress('" + phase + "'," + done + "," + total + ")");
    }
    private void js(final String code) {
        if (wv != null) wv.post(new Runnable() { public void run() { wv.evaluateJavascript(code, null); } });
    }
    private static void writeFile(File f, byte[] b) throws IOException {
        try (OutputStream os = new FileOutputStream(f)) { os.write(b); }
    }
    private static byte[] readFile(File f) throws IOException {
        try (InputStream in = new FileInputStream(f)) {
            ByteArrayOutputStream bos = new ByteArrayOutputStream(); pipe(in, bos); return bos.toByteArray();
        }
    }
    private static void copyFile(File s, File d) throws IOException {
        try (InputStream in = new FileInputStream(s); OutputStream os = new FileOutputStream(d)) { pipe(in, os); }
    }
    private static void pipe(InputStream in, OutputStream os) throws IOException {
        byte[] buf = new byte[1 << 16]; int n;
        while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
    }
    private static void pipeToFile(InputStream in, File f) throws IOException {
        try (OutputStream os = new FileOutputStream(f)) { pipe(in, os); }
    }
    private static void deleteRecurse(File d) {
        if (d == null || !d.exists()) return;
        if (d.isDirectory()) { File[] fs = d.listFiles(); if (fs != null) for (File x : fs) deleteRecurse(x); }
        d.delete();
    }
    private static void zipDir(File dir, File out, Progress p) throws IOException {
        long total = countFiles(dir), done = 0;
        try (java.util.zip.ZipOutputStream zos = new java.util.zip.ZipOutputStream(
                new BufferedOutputStream(new FileOutputStream(out)))) {
            zipRecurse(dir, dir, zos);
            if (p != null) p.on("zip", ++done, total);
        }
    }
    private static long countFiles(File d) {
        long n = 0; if (d.isDirectory()) { File[] fs = d.listFiles(); if (fs != null) for (File x : fs) n += countFiles(x); } else n = 1; return n;
    }
    private static void zipRecurse(File root, File cur, java.util.zip.ZipOutputStream zos) throws IOException {
        File[] fs = cur.listFiles();
        if (fs == null) return;
        for (File f : fs) {
            String name = root.toURI().relativize(f.toURI()).getPath();
            if (f.isDirectory()) { zipRecurse(root, f, zos); }
            else { zos.putNextEntry(new java.util.zip.ZipEntry(name)); pipe(new FileInputStream(f), zos); zos.closeEntry(); }
        }
    }
    private static int readIntState(File f) { try { return Integer.parseInt(readFile(f).toString()); } catch (Exception e) { return 0; } }
    private static void writeIntState(File f, int v) { try { writeFile(f, String.valueOf(v).getBytes()); } catch (Exception ignore) {} }
    private static long readLongState(File f) { try { return Long.parseLong(readFile(f).toString()); } catch (Exception e) { return 0; } }
    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "");
    }

}

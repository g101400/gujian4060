# Install script for directory: D:/Users/Claw/ai-lab/ncnn-20211208/src

# Set the install prefix
if(NOT DEFINED CMAKE_INSTALL_PREFIX)
  set(CMAKE_INSTALL_PREFIX "D:/Android/ncnn-libs/ncnn-20211208-android/arm64-v8a")
endif()
string(REGEX REPLACE "/$" "" CMAKE_INSTALL_PREFIX "${CMAKE_INSTALL_PREFIX}")

# Set the install configuration name.
if(NOT DEFINED CMAKE_INSTALL_CONFIG_NAME)
  if(BUILD_TYPE)
    string(REGEX REPLACE "^[^A-Za-z0-9_]+" ""
           CMAKE_INSTALL_CONFIG_NAME "${BUILD_TYPE}")
  else()
    set(CMAKE_INSTALL_CONFIG_NAME "Release")
  endif()
  message(STATUS "Install configuration: \"${CMAKE_INSTALL_CONFIG_NAME}\"")
endif()

# Set the component getting installed.
if(NOT CMAKE_INSTALL_COMPONENT)
  if(COMPONENT)
    message(STATUS "Install component: \"${COMPONENT}\"")
    set(CMAKE_INSTALL_COMPONENT "${COMPONENT}")
  else()
    set(CMAKE_INSTALL_COMPONENT)
  endif()
endif()

# Install shared libraries without execute permission?
if(NOT DEFINED CMAKE_INSTALL_SO_NO_EXE)
  set(CMAKE_INSTALL_SO_NO_EXE "0")
endif()

# Is this installation the result of a crosscompile?
if(NOT DEFINED CMAKE_CROSSCOMPILING)
  set(CMAKE_CROSSCOMPILING "TRUE")
endif()

# Set default install directory permissions.
if(NOT DEFINED CMAKE_OBJDUMP)
  set(CMAKE_OBJDUMP "D:/Android/ndk/21.4.7075529/toolchains/llvm/prebuilt/windows-x86_64/bin/llvm-objdump.exe")
endif()

if("x${CMAKE_INSTALL_COMPONENT}x" STREQUAL "xUnspecifiedx" OR NOT CMAKE_INSTALL_COMPONENT)
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib" TYPE STATIC_LIBRARY FILES "D:/Users/Claw/src/libncnn.a")
endif()

if("x${CMAKE_INSTALL_COMPONENT}x" STREQUAL "xUnspecifiedx" OR NOT CMAKE_INSTALL_COMPONENT)
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/include/ncnn" TYPE FILE FILES
    "D:/Users/Claw/ai-lab/ncnn-20211208/src/allocator.h"
    "D:/Users/Claw/ai-lab/ncnn-20211208/src/benchmark.h"
    "D:/Users/Claw/ai-lab/ncnn-20211208/src/blob.h"
    "D:/Users/Claw/ai-lab/ncnn-20211208/src/c_api.h"
    "D:/Users/Claw/ai-lab/ncnn-20211208/src/command.h"
    "D:/Users/Claw/ai-lab/ncnn-20211208/src/cpu.h"
    "D:/Users/Claw/ai-lab/ncnn-20211208/src/datareader.h"
    "D:/Users/Claw/ai-lab/ncnn-20211208/src/gpu.h"
    "D:/Users/Claw/ai-lab/ncnn-20211208/src/layer.h"
    "D:/Users/Claw/ai-lab/ncnn-20211208/src/layer_shader_type.h"
    "D:/Users/Claw/ai-lab/ncnn-20211208/src/layer_type.h"
    "D:/Users/Claw/ai-lab/ncnn-20211208/src/mat.h"
    "D:/Users/Claw/ai-lab/ncnn-20211208/src/modelbin.h"
    "D:/Users/Claw/ai-lab/ncnn-20211208/src/net.h"
    "D:/Users/Claw/ai-lab/ncnn-20211208/src/option.h"
    "D:/Users/Claw/ai-lab/ncnn-20211208/src/paramdict.h"
    "D:/Users/Claw/ai-lab/ncnn-20211208/src/pipeline.h"
    "D:/Users/Claw/ai-lab/ncnn-20211208/src/pipelinecache.h"
    "D:/Users/Claw/ai-lab/ncnn-20211208/src/simpleocv.h"
    "D:/Users/Claw/ai-lab/ncnn-20211208/src/simpleomp.h"
    "D:/Users/Claw/ai-lab/ncnn-20211208/src/simplestl.h"
    "D:/Users/Claw/ai-lab/ncnn-20211208/src/vulkan_header_fix.h"
    "D:/Users/Claw/src/ncnn_export.h"
    "D:/Users/Claw/src/layer_shader_type_enum.h"
    "D:/Users/Claw/src/layer_type_enum.h"
    "D:/Users/Claw/src/platform.h"
    )
endif()

if("x${CMAKE_INSTALL_COMPONENT}x" STREQUAL "xUnspecifiedx" OR NOT CMAKE_INSTALL_COMPONENT)
  if(EXISTS "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/cmake/ncnn/ncnn.cmake")
    file(DIFFERENT EXPORT_FILE_CHANGED FILES
         "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/cmake/ncnn/ncnn.cmake"
         "D:/Users/Claw/src/CMakeFiles/Export/lib/cmake/ncnn/ncnn.cmake")
    if(EXPORT_FILE_CHANGED)
      file(GLOB OLD_CONFIG_FILES "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/cmake/ncnn/ncnn-*.cmake")
      if(OLD_CONFIG_FILES)
        message(STATUS "Old export file \"$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/cmake/ncnn/ncnn.cmake\" will be replaced.  Removing files [${OLD_CONFIG_FILES}].")
        file(REMOVE ${OLD_CONFIG_FILES})
      endif()
    endif()
  endif()
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib/cmake/ncnn" TYPE FILE FILES "D:/Users/Claw/src/CMakeFiles/Export/lib/cmake/ncnn/ncnn.cmake")
  if("${CMAKE_INSTALL_CONFIG_NAME}" MATCHES "^([Rr][Ee][Ll][Ee][Aa][Ss][Ee])$")
    file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib/cmake/ncnn" TYPE FILE FILES "D:/Users/Claw/src/CMakeFiles/Export/lib/cmake/ncnn/ncnn-release.cmake")
  endif()
endif()

if("x${CMAKE_INSTALL_COMPONENT}x" STREQUAL "xUnspecifiedx" OR NOT CMAKE_INSTALL_COMPONENT)
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib/cmake/ncnn" TYPE FILE FILES "D:/Users/Claw/src/ncnnConfig.cmake")
endif()


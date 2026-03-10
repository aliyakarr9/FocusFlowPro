#!/bin/zsh
set -e
mkdir -p FocusFlowPro.iconset
IMG="/Users/ayakar/.gemini/antigravity/brain/ba1d131d-2b03-4dde-be1f-a92cf541c688/focusflow_logo_1772370624491.png"

sips -z 16 16     "$IMG" --out FocusFlowPro.iconset/icon_16x16.png
sips -z 32 32     "$IMG" --out FocusFlowPro.iconset/icon_16x16@2x.png
sips -z 32 32     "$IMG" --out FocusFlowPro.iconset/icon_32x32.png
sips -z 64 64     "$IMG" --out FocusFlowPro.iconset/icon_32x32@2x.png
sips -z 128 128   "$IMG" --out FocusFlowPro.iconset/icon_128x128.png
sips -z 256 256   "$IMG" --out FocusFlowPro.iconset/icon_128x128@2x.png
sips -z 256 256   "$IMG" --out FocusFlowPro.iconset/icon_256x256.png
sips -z 512 512   "$IMG" --out FocusFlowPro.iconset/icon_256x256@2x.png
sips -z 512 512   "$IMG" --out FocusFlowPro.iconset/icon_512x512.png
sips -z 1024 1024 "$IMG" --out FocusFlowPro.iconset/icon_512x512@2x.png

iconutil -c icns FocusFlowPro.iconset
rm -rf FocusFlowPro.iconset

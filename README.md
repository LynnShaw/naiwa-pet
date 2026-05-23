# Naiwa Pet

奶蛙-一个轻量级 Tauri 桌面宠物应用，支持 Windows 和 macOS。

## 桌面效果

![Naiwa Pet 桌面演示](public/demo.webp)


## 常用命令

```sh
npm install
npm run assets:naiwa
npm run tauri:dev
npm run tauri:build
```

## 宠物素材

默认宠物素材位于 `public/pets/naiwa`。

- `manifest.json` 用于描述动画。
- `frames/*.webp` 是透明背景的动画帧。
- `audio.m4a` 是从源素材中提取的音频。

如果需要从 `naiwa.mp4` 重新生成内置的 Naiwa 素材：

```sh
npm run assets:naiwa
```

以后如果要添加其他宠物，可以创建一个结构相同的素材目录，并更新 `src/main.ts` 中的 `DEFAULT_PET_ID`。

## 构建

本地 macOS 构建产物会输出到 `src-tauri/target/release/bundle`。
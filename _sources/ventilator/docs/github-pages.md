# GitHub Pages 发布

仓库：https://github.com/xcy795182-debug/xcy795182-debug.github.io
网站：https://xcy795182-debug.github.io/ventilator/

静态产物放在仓库ventilator/，可维护源码放在_sources/ventilator/，保留原index.html和rounds/。不上传用户教材、Word原文件、node_modules及整个医学助手工作区。

更新时在源码目录运行npm ci、npm test、npm run build；将dist/内容同步至仓库ventilator/，提交到main，由现有GitHub Pages分支发布流程更新。Vite使用相对资源路径，支持子目录。

当前发布为教学开发预览，界面保留模拟边界说明。

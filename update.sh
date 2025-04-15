#!/bin/bash
cd /tmp
tar -xzf update_files.tar.gz
cd /var/www/html
cp -f /tmp/server.js .
mkdir -p public/js
cp -f /tmp/public/js/main.js public/js/
if [ -f "server.pid" ]; then kill -HUP $(cat server.pid) || kill $(cat server.pid); fi
command -v pm2 >/dev/null && pm2 restart all || echo "未找到pm2，无法自动重启"
echo "更新完成！"

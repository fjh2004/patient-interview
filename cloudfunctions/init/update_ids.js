const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'index.js');
let content = fs.readFileSync(filePath, 'utf8');

// 将所有 "id":0, 改为 "id":1, 以此类推
for (let i = 32; i >= 0; i--) {
  const fromPattern = `"id":${i},`;
  const toPattern = `"id":${i+1},`;
  content = content.replace(fromPattern, toPattern);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('ID更新完成');

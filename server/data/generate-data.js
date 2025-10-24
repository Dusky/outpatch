
const fs = require('fs');
const path = require('path');
const { generateAllData } = require('./generators');

const data = generateAllData();

fs.writeFileSync(path.join(__dirname, 'data.json'), JSON.stringify(data, null, 2));

console.log('Data generated successfully!');

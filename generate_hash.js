// Ejecuta con: node generate_hash.js
const bcrypt = require('bcrypt');

async function run() {
  const saltRounds = 12;

  const users = {
    admin: "admin123",
    profjuan: "profesor123",
    estana: "estudiante123"
  };

  for (const [username, password] of Object.entries(users)) {
    const hash = await bcrypt.hash(password, saltRounds);
    console.log(`${username} -> ${password} -> ${hash}`);
  }
}

run();

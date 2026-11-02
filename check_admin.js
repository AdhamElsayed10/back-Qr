const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.admin.findMany();
  console.log('Found ' + admins.length + ' admin(s)');
  
  for (const a of admins) {
    console.log('  ID:', a.id);
    console.log('  Email:', a.email);
    console.log('  PW length:', a.password.length);
    console.log('  PW prefix:', a.password.substring(0, 40));
    console.log('  PW starts with $2a$:', a.password.startsWith('$2a$'));
    
    // Test bcrypt compare
    const testPass = process.env.ADMIN_PASSWORD || 'ChangeMe_12345';
    const valid = await bcrypt.compare(testPass, a.password);
    console.log('  bcrypt.compare with', testPass + ':', valid);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });

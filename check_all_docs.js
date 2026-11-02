const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const docs = await prisma.document.findMany();
  console.log(`Found ${docs.length} documents in local DB.`);
  for(let d of docs) {
    console.log(d.id, d.title, d.createdAt);
  }
}

main().finally(() => prisma.$disconnect());

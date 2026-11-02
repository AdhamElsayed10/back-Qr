const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const doc = await prisma.document.findUnique({
    where: { qrToken: 'd644f96f-d996-495b-8c6b-f421866ec2d6' }
  });
  console.log(doc);
}

main().finally(() => prisma.$disconnect());

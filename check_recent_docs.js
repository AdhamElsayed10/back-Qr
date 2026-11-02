const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const docs = await prisma.document.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  console.log('Total recent docs:', docs.length);
  for (const d of docs) {
    console.log({
      id: d.id,
      title: d.title,
      isDataFilled: d.isDataFilled,
      status: d.processingStatus,
      createdAt: d.createdAt,
      originalFilePath: d.originalFilePath,
      processedFilePath: d.processedFilePath,
      hasContractData: Boolean(d.contractData),
    });
  }
  await prisma.$disconnect();
}
check().catch(console.error);

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const {
  OSAMA_CONTRACT_DATA,
  QARTOUBI_CONTRACT_DATA,
  QASAI_CONTRACT_DATA,
} = require('../src/services/extractor.service');

const prisma = new PrismaClient();

async function main() {
  // 1. Admin Account
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'get ';

  const existing = await prisma.admin.findUnique({ where: { email } });
  const hashed = await bcrypt.hash(password, 12);
  if (existing) {
    await prisma.admin.update({
      where: { id: existing.id },
      data: { password: hashed },
    });
    console.log(`Admin password synchronized: ${email}`);
  } else {
    await prisma.admin.create({
      data: { email, password: hashed },
    });
    console.log(`✅ Admin created: ${email}`);
  }

  // 2. Pre-seed Osama Contract
  const osamaToken = 'e7c84433-5b87-4d92-9cf0-019983734301';
  const osamaUrl = `https://ejaar.fujmen.com/pdf/${osamaToken}`;
  await prisma.document.upsert({
    where: { qrToken: osamaToken },
    update: {
      title: 'اسامه بن سعيد بن عبدالله بن سليمان الصالحي',
      qrUrl: osamaUrl,
      isDataFilled: true,
      processingStatus: 'COMPLETED',
      contractData: JSON.stringify(OSAMA_CONTRACT_DATA),
    },
    create: {
      title: 'اسامه بن سعيد بن عبدالله بن سليمان الصالحي',
      originalFilePath: 'assets/osama.pdf',
      processedFilePath: 'uploads/processed/osama.pdf',
      qrToken: osamaToken,
      qrUrl: osamaUrl,
      isDataFilled: true,
      processingStatus: 'COMPLETED',
      contractData: JSON.stringify(OSAMA_CONTRACT_DATA),
    },
  });
  console.log(`✅ Osama contract pre-seeded: ${osamaUrl}`);

  // 3. Pre-seed 6880795200 (Hamed Khamis Alqartoubi) Contract
  const qartoubiToken = 'a23b2a9c-678c-4fd6-ac2d-cbcfb3ff997d';
  const qartoubiUrl = `https://ejaar.fujmen.com/pdf/${qartoubiToken}`;
  await prisma.document.upsert({
    where: { qrToken: qartoubiToken },
    update: {
      title: '6880795200 - HAMED KHAMIS SALIM SULAIMAN AL QARTOUBI',
      qrUrl: qartoubiUrl,
      isDataFilled: true,
      processingStatus: 'COMPLETED',
      contractData: JSON.stringify(QARTOUBI_CONTRACT_DATA),
    },
    create: {
      title: '6880795200 - HAMED KHAMIS SALIM SULAIMAN AL QARTOUBI',
      originalFilePath: 'assets/6880795200.pdf',
      processedFilePath: 'uploads/processed/6880795200.pdf',
      qrToken: qartoubiToken,
      qrUrl: qartoubiUrl,
      isDataFilled: true,
      processingStatus: 'COMPLETED',
      contractData: JSON.stringify(QARTOUBI_CONTRACT_DATA),
    },
  });
  console.log(`✅ 6880795200 contract pre-seeded: ${qartoubiUrl}`);

  // 4. Pre-seed #000000 (Qasai Khalil Khamis Alqartoubi) Contract
  const qasaiToken = '87c014c8-ca04-4773-8aca-7c9cc837bdf9';
  const qasaiUrl = `https://ejaar.fujmen.com/pdf/${qasaiToken}`;
  await prisma.document.upsert({
    where: { qrToken: qasaiToken },
    update: {
      title: 'QASAI KHALIL KHAMIS ALQARTOUBI (#000000)',
      qrUrl: qasaiUrl,
      isDataFilled: true,
      processingStatus: 'COMPLETED',
      contractData: JSON.stringify(QASAI_CONTRACT_DATA),
    },
    create: {
      title: 'QASAI KHALIL KHAMIS ALQARTOUBI (#000000)',
      originalFilePath: 'assets/#000000.pdf',
      processedFilePath: 'uploads/processed/#000000.pdf',
      qrToken: qasaiToken,
      qrUrl: qasaiUrl,
      isDataFilled: true,
      processingStatus: 'COMPLETED',
      contractData: JSON.stringify(QASAI_CONTRACT_DATA),
    },
  });
  console.log(`✅ #000000 contract pre-seeded: ${qasaiUrl}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

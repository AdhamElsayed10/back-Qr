const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEFAULTS = {
  qrPosition: 'custom',
  qrSize: 70,
  customX: 45,
  customY: 635,
  applyTo: 'first',
};

exports.getSettings = async (req, res) => {
  try {
    let settings = await prisma.qRSettings.findFirst();
    if (!settings) {
      settings = await prisma.qRSettings.create({ data: DEFAULTS });
    }
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { qrPosition, qrSize, customX, customY, applyTo } = req.body || {};

    const updateData = {};
    if (qrPosition !== undefined) updateData.qrPosition = String(qrPosition);
    if (qrSize !== undefined && !Number.isNaN(Number(qrSize))) updateData.qrSize = Math.max(20, Math.min(300, parseInt(qrSize, 10)));
    if (customX !== undefined && !Number.isNaN(Number(customX))) updateData.customX = Math.max(0, parseInt(customX, 10));
    if (customY !== undefined && !Number.isNaN(Number(customY))) updateData.customY = Math.max(0, parseInt(customY, 10));
    if (applyTo !== undefined) updateData.applyTo = String(applyTo);

    let settings = await prisma.qRSettings.findFirst();

    if (settings) {
      settings = await prisma.qRSettings.update({
        where: { id: settings.id },
        data: Object.keys(updateData).length > 0 ? updateData : DEFAULTS,
      });
    } else {
      settings = await prisma.qRSettings.create({
        data: {
          ...DEFAULTS,
          ...updateData,
        },
      });
    }

    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEFAULT_PUBLIC_ALERT_TEXT = 'تنبيه: صلاحية هذه الإفادة {days} يوماً فقط من تاريخ الإصدار.';

const DEFAULTS = {
  qrPosition: 'custom',
  qrSize: 70,
  customX: 45,
  customY: 635,
  applyTo: 'first',
  publicValidityDays: 30,
  publicExpirySource: 'issue',
  publicAlertText: DEFAULT_PUBLIC_ALERT_TEXT,
  publicShowAlert: true,
};

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (value === true || value === 1 || value === '1' || value === 'true' || value === 'on') return true;
  if (value === false || value === 0 || value === '0' || value === 'false' || value === 'off') return false;
  return fallback;
}

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
    const {
      qrPosition,
      qrSize,
      customX,
      customY,
      applyTo,
      publicValidityDays,
      publicExpirySource,
      publicAlertText,
      publicShowAlert,
    } = req.body || {};

    const updateData = {};
    if (qrPosition !== undefined) updateData.qrPosition = String(qrPosition);
    if (qrSize !== undefined && !Number.isNaN(Number(qrSize))) updateData.qrSize = Math.max(20, Math.min(300, parseInt(qrSize, 10)));
    if (customX !== undefined && !Number.isNaN(Number(customX))) updateData.customX = Math.max(0, parseInt(customX, 10));
    if (customY !== undefined && !Number.isNaN(Number(customY))) updateData.customY = Math.max(0, parseInt(customY, 10));
    if (applyTo !== undefined) updateData.applyTo = String(applyTo);
    if (publicValidityDays !== undefined && publicValidityDays !== '' && !Number.isNaN(Number(publicValidityDays))) {
      updateData.publicValidityDays = Math.max(1, Math.min(3650, parseInt(publicValidityDays, 10)));
    }
    if (publicExpirySource !== undefined) {
      const source = String(publicExpirySource);
      if (source === 'issue' || source === 'contract') updateData.publicExpirySource = source;
    }
    if (publicAlertText !== undefined) {
      updateData.publicAlertText = String(publicAlertText).slice(0, 500);
    }
    if (publicShowAlert !== undefined) {
      updateData.publicShowAlert = parseBoolean(publicShowAlert, true);
    }

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

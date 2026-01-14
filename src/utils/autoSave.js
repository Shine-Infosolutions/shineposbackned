// Auto-save utility functions
const autoSaveDocument = async (document) => {
  try {
    if (document.isModified()) {
      await document.save();
      console.log(`Auto-saved: ${document.constructor.modelName} - ${document._id}`);
    }
  } catch (error) {
    console.error('Auto-save error:', error);
  }
};

const autoSaveWithRetry = async (document, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      await autoSaveDocument(document);
      return;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
    }
  }
};

module.exports = {
  autoSaveDocument,
  autoSaveWithRetry
};
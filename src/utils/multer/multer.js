/* ************************************************************************** */
/* /src/utils/multer/multer.js - Configuración de Multer  (middleware de manejo de
 archivos para aplicaciones web basadas en Node.js)
/* ************************************************************************** */

const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

/*  Importar el objeto req configurado con el middleware para utilizar logger 
antes de la inicialización de la app */
const req = require('../../utils/logger/loggerSetup');

// Ruta base para las carpetas de almacenamiento
const storageBasePath = './src/uploads';

// Función para crear una carpeta si no existe
const createFolderIfNotExists = (folder) => {
  const folderPath = path.join(storageBasePath, folder);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
    req.logger.info('Carpeta creada por Multer');
  }
};

const storage = (folder) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      // Crear la carpeta si no existe
      createFolderIfNotExists(folder);
      cb(null, path.join(storageBasePath, folder));
    },
    filename: (req, file, cb) => {
      const uniquePrefix = uuidv4().slice(0, 4);
      cb(null, uniquePrefix + '-' + file.originalname);
    },
  });

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf', 'image/webp', 'image/svg+xml', 'image/jpg'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido'));
  }
};

const uploadProfiles = multer({
  storage: storage('profiles'),
  fileFilter: fileFilter,
});
const uploadProducts = multer({
  storage: storage('products'),
  fileFilter: fileFilter,
});
const uploadDocuments = multer({
  storage: storage('documents'),
  fileFilter: fileFilter,
});

module.exports = {
  uploadProfiles,
  uploadProducts,
  uploadDocuments,
};

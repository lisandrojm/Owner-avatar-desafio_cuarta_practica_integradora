/* ************************************************************************** */
/* /src/components/users/usersServices/usersServices.js -
 controlador de los usuarios. */
/* ************************************************************************** */

const { User } = require('../../../models/users');
const JWTService = require('../../../utils/jwt/jwt');
const jwt = require('jsonwebtoken');
const { createHash } = require('../../../utils/bcrypt/bcrypt');
const { Cart } = require('../../../models/carts');
const { config } = require('../../../config');
/* Repository */
const { cartsServices } = require('../../../repositories/index');
const { usersServices } = require('../../../repositories/index');
/* ************************************************************************** */
/* test customError */
/* ************************************************************************** */
const CustomError = require('../../../utils/errors/services/customError');
const EErrors = require('../../../utils/errors/services/enums');
const { generateUserErrorInfo } = require('../../../utils/errors/services/info');
/* ************************************************************************** */
const MailManager = require('../../../utils/mailManager/mailManager');
const path = require('path');
const PORT = `${config.port}`;
const bcrypt = require('bcrypt');

/* const req = require('../../../utils/logger/loggerSetup'); */

class UsersServices {
  /* ////////////////////////////////////////// */
  /* Jwt */
  /* ////////////////////////////////////////// */

  getUsers = async (req, res) => {
    try {
      /* Repository */
      const users = await usersServices.findAll();
      const data = users;
      return res.sendSuccess({ message: 'Todos los usuarios', payload: data });
    } catch (error) {
      return res.sendServerError('Error al obtener los usuarios');
    }
  };

  registerUser = async (req, payload, res) => {
    try {
      const { first_name, last_name, email, age, password, role } = payload;

      if (!first_name || !last_name || !email || !age || !password) {
        return res.sendServerError('Faltan campos obligatorios');
      }

      /* Repository */
      const existingUser = await usersServices.findOne({ email: email });

      if (existingUser) {
        return res.sendUserError('Ya existe un usuario con el mismo correo electrónico');
      }

      const newUser = new User({
        first_name,
        last_name,
        email,
        age,
        password: createHash(password),
        role,
      });

      /* Utilización de DTO de  /src/repositories/users.repository.js   */
      const savedUser = await usersServices.createUserDTO(newUser);

      const userCart = new Cart({
        user: savedUser._id,
        products: [],
      });

      /* Repository */
      await cartsServices.save(userCart);

      savedUser.cart = userCart._id;
      await savedUser.save();

      const data = newUser;
      const token = await JWTService.generateJwt({ id: savedUser._id });
      /* Repository */
      await usersServices.findByIdAndUpdate(savedUser._id, { token }, { new: true });

      /* Repository */
      /*       let updatedUser = await usersServices.findByIdAndUpdate(savedUser._id, { token }, { new: true }); */
      /*       console.log('~~~User registrado~~~', updatedUser); */

      /*Logger */
      /*       req.logger.debug(`User registrado: ${JSON.stringify(updatedUser, null, 2)}`); */

      return res.sendCreated({
        payload: {
          message: 'Usuario agregado correctamente',
          token,
          data,
        },
      });
    } catch (error) {
      /*Logger */
      req.logger.error('Error al agregar el usuario');
      return res.sendServerError('Error al agregar el usuario');
    }
  };
  /* Método addUser dejado como muestra de implementación de CustomError. Es reemplazado por registerUser  */
  addUser = async (payload, res) => {
    try {
      const { first_name, last_name, age, email, password } = payload;
      /* ************************************************************************** */
      /* test customError */
      /* ************************************************************************** */
      if (!first_name || !last_name || !email) {
        /*         console.log('entra al bloque'); */
        try {
          CustomError.createError({
            name: 'User creation error',
            cause: generateUserErrorInfo({ first_name, last_name, age, email, password }),
            message: 'Error Trying to create User',
            code: EErrors.INVALID_TYPES_ERROR,
          });
        } catch (error) {
          console.error('Ocurrió un error en CustomError:', error);
        }
        return res.sendServerError('Faltan campos obligatorios del Usuario');
      }

      /* Repository */
      const existingUser = await usersServices.findOne({ email: email });

      if (existingUser) {
        return res.sendUserError('Ya existe un usuario con el mismo correo electrónico');
      }

      const newUser = new User({
        first_name,
        last_name,
        email,
        age,
        password: createHash(password),
      });

      /* Repository */
      await usersServices.save(newUser);

      const userCart = new Cart({
        user: newUser._id,
        products: [],
      });

      /* Repository */
      await cartsServices.save(userCart);

      newUser.cart = userCart._id;

      const data = newUser;

      return res.sendCreated({ message: 'Usuario agregado correctamente', payload: data });
    } catch (error) {
      return res.sendServerError('Error al agregar el usuario');
    }
  };

  recoveryUser = async ({ email, password, res }) => {
    try {
      /* Repository */
      let user = await usersServices.findOne({
        email: email,
      });

      if (!user) {
        return res.sendUnauthorized('El usuario no existe en la base de datos');
      }

      /* Repository */
      let data = await usersServices.findByIdAndUpdate(user._id, { password: createHash(password) }, { new: true });

      return res.sendSuccess({ message: 'Contraseña actualizada correctamente', payload: data });
    } catch (error) {
      return res.sendServerError('Error al recuperar la contraseña');
    }
  };

  getUserById = async (uid, res) => {
    try {
      /* Repository */
      const user = await usersServices.findById(uid);

      if (!user) {
        return res.sendNotFound('Usuario no encontrado');
      }

      const data = user;

      return res.sendSuccess({ message: 'Usuario obtenido correctamente', payload: data });
    } catch (error) {
      return res.sendServerError('Error al obtener el usuario');
    }
  };

  updateUser = async (uid, updateFields, res, req) => {
    try {
      const allowedFields = ['first_name', 'last_name', 'email', 'age', 'password', 'role'];

      const invalidFields = Object.keys(updateFields).filter((field) => !allowedFields.includes(field));

      if (invalidFields.length > 0) {
        return res.sendUserError(`Los siguientes campos no se pueden modificar: ${invalidFields.join(', ')}`);
      }

      // Validar si el campo 'role' existe en los campos de actualización
      if (updateFields.hasOwnProperty('role')) {
        // Verificar si el valor de 'role' es uno de los valores permitidos
        if (!['admin', 'user', 'premium'].includes(updateFields.role)) {
          return res.sendUserError('El campo "role" solo puede cambiar a "admin", "user" o "premium"');
        }
      }

      /* Repository */
      const updatedUser = await usersServices.findByIdAndUpdate(uid, updateFields, { new: true });

      if (!updatedUser) {
        return res.sendNotFound('Usuario no encontrado');
      }

      req.app.io.emit('updateUser', updatedUser);

      const data = updatedUser;

      return res.sendSuccess({ message: 'Usuario actualizado correctamente', payload: data });
    } catch (error) {
      return res.sendServerError('Error al actualizar el usuario');
    }
  };

  deleteUser = async (uid, res, req) => {
    try {
      /* Repository */
      const deletedUser = await usersServices.findByIdAndDelete(uid);

      if (!deletedUser) {
        return res.sendNotFound('Usuario no encontrado');
      }

      req.app.io.emit('deleteUser', uid);
      const data = deletedUser;
      return res.sendSuccess({ message: 'Usuario eliminado correctamente', payload: data });
    } catch (error) {
      return res.sendServerError('Error al eliminar el usuario');
    }
  };

  resetPass = async ({ email, password, res, req }) => {
    try {
      // Buscar al usuario por correo electrónico
      const user = await usersServices.findOne({ email });

      if (!user) {
        req.logger.info('Usuario no encontrado');
        return res.sendNotFound('Usuario no encontrado');
      }

      // Comprobar si la contraseña proporcionada coincide con la almacenada en la base de datos
      const passwordMatch = bcrypt.compareSync(password, user.password);

      if (passwordMatch) {
        req.logger.info('La nueva contraseña es la misma que la contraseña actual.');
        return res.sendUserError('La nueva contraseña es la misma que la contraseña actual. No se puede colacar la misma contraseña.');
      }

      // Actualizar la contraseña solo si es diferente
      const newPasswordHash = createHash(password);
      // Actualizar la contraseña en la base de datos
      let data = await usersServices.findByIdAndUpdate(user._id, { password: newPasswordHash }, { new: true });

      req.logger.info('Contraseña actualizada');
      return res.sendSuccess({ message: 'Contraseña actualizada correctamente', payload: data });
    } catch (error) {
      req.logger.error('Error al recuperar la contraseña');
      return res.sendServerError('Error al recuperar la contraseña');
    }
  };

  resetPassByEmail = async (email, res, req) => {
    try {
      // Buscar al usuario por correo electrónico
      const user = await usersServices.findOne({ email });

      /*       req.logger.debug('resetPassByEmail', user); */

      if (!user) {
        return res.sendNotFound('Usuario no encontrado');
      }

      const username = user.email;
      const resetPasswordToken = jwt.sign({ userId: user._id }, config.jwt_secret, {
        expiresIn: '1h', // Token expira después de 1 hora
      });

      // Crear la URL de restablecimiento de contraseña
      const resetPasswordLink = `http://localhost:${PORT}/resetpass/${resetPasswordToken}`;

      // Contenido del correo electrónico
      const emailContent = `
      <h1>Reestablezca su contraseña</h1>
      <p>Username: ${username}</p>
      <p>Acceda <a href="${resetPasswordLink}">aquí</a> para reestablecer su contraseña.</p>
      <!-- Agrega cualquier otra información que desees en el correo -->
    `;

      // Configuración del correo electrónico
      const attachments = [
        {
          filename: 'freelo.png',
          path: path.join(__dirname, '../../../uploads/mail/freelo.png'),
        },
      ];

      const emailPayload = {
        from: 'lisandrojm@gmail.com',
        to: user.email,
        subject: 'FreeloECOM - Reestablecimiento de contraseña',
        html: emailContent,
        attachments,
      };

      // Enviar el correo electrónico
      await MailManager.sendEmail(emailPayload);

      const data = emailPayload;

      // Guardar el token en una cookie con el nombre 'resetPasswordToken'
      res.cookie('resetPasswordToken', resetPasswordToken, { maxAge: 3600000 }); // Cookie expira en 1 hora (3600000 ms)

      req.logger.info('Mail de reestablecimiento de contraseña enviado correctamente');
      return res.sendSuccess({
        payload: {
          message: 'Mail de reestablecimiento de contraseña enviado correctamente',
          data,
        },
      });
    } catch (error) {
      req.logger.error('Error al reestablecer la contraseña y enviar el correo electrónico');
      return res.sendServerError('Error al reestablecer la contraseña y enviar el correo electrónico');
    }
  };
  updateUserPremium = async (uid, updateFields, res, req) => {
    try {
      const allowedFields = ['role'];

      // Verificar si el campo 'role' existe en updateFields y si su valor es 'user' o 'premium'
      if (updateFields.hasOwnProperty('role') && !['user', 'premium'].includes(updateFields.role)) {
        return res.sendUserError('Eres un user premium. El campo role solo puedes cambiarlo a user o premium');
      }

      // Repository
      const user = await usersServices.findById(uid);

      if (!user) {
        return res.sendNotFound('Usuario no encontrado');
      }

      if (updateFields.role === 'premium') {
        // Verificar si los documentos requeridos han sido cargados
        if (user.premium_documents_status !== 'upload') {
          return res.sendUserError('El usuario no ha completado la documentación necesaria para ser premium');
        }
      }

      const invalidFields = Object.keys(updateFields).filter((field) => !allowedFields.includes(field));

      if (invalidFields.length > 0) {
        return res.sendUserError(`Los siguientes campos no se pueden modificar: ${invalidFields.join(', ')}`);
      }

      /* Repository */
      const updatedUser = await usersServices.findByIdAndUpdate(uid, updateFields, { new: true });

      if (!updatedUser) {
        return res.sendNotFound('Usuario no encontrado');
      }

      req.app.io.emit('updateUser', updatedUser);

      const data = updatedUser;

      return res.sendSuccess({ message: 'Role de user actualizado correctamente', payload: data });
    } catch (error) {
      return res.sendServerError('Error al actualizar el usuario');
    }
  };

  /*   ************************************************************* */
  uploadDocuments = async (uid, res, req) => {
    try {
      // Verificar si el usuario existe
      const user = await usersServices.findById(uid);
      if (!user) {
        return res.sendNotFound('Usuario no encontrado');
      }

      // Verificar si se cargaron documentos
      if (!req.files || req.files.length === 0) {
        return res.sendUserError('No se cargaron documentos');
      }
      /*       console.log('Files', req.files); */

      // Por ejemplo, si deseas guardar la información de los documentos en la base de datos
      const documentInfo = req.files.map((file) => {
        return {
          name: file.filename,
          reference: file.destination,
          mimetype: file.mimetype,
          fieldname: file.fieldname,
          /* status: 'upload', */
        };
      });

      // Obtén el nombre del último documento agregado
      const newDocumentName = documentInfo[documentInfo.length - 1].name;

      // Actualiza el estado del usuario para indicar que se han subido documentos
      user.documents.push(...documentInfo); // Agrega los nuevos documentos al arreglo de documentos del usuario
      // Comprobar si el usuario ya tiene al menos un documento de cada uno de los fieldnames requeridos
      const hasIdentificacion = user.documents.some((doc) => doc.fieldname === 'identificacion');
      const hasComprobanteDeDomicilio = user.documents.some((doc) => doc.fieldname === 'comprobanteDeDomicilio');
      const hasComprobanteDeEstadoDeCuenta = user.documents.some((doc) => doc.fieldname === 'comprobanteDeEstadoDeCuenta');

      if (hasIdentificacion && hasComprobanteDeDomicilio && hasComprobanteDeEstadoDeCuenta) {
        user.premium_documents_status = 'upload'; // Actualiza el estado a 'upload'
      } else {
        user.premium_documents_status = 'pending'; // Deja el estado como 'pending'
      }
      user.documents_status = 'upload'; // Cambia el estado de documents_status a 'upload'
      const savedUser = await user.save();

      // Busca el documento recién creado en la base de datos por su nombre
      const newlyCreatedDocument = savedUser.documents.find((doc) => doc.name === newDocumentName);

      if (newlyCreatedDocument) {
        const documentIds = documentInfo.map((file) => {
          const matchingDocument = savedUser.documents.find((doc) => doc.name === file.name);
          return matchingDocument._id;
        });

        /*         console.log('IDs de los nuevos documentos:', documentIds); */

        // Actualiza el documentoInfo con IDs individuales
        const updatedDocumentInfo = documentInfo.map((file, index) => {
          return {
            id: documentIds[index], // Agregar el ID del documento
            name: file.name,
            reference: file.reference,
            mimetype: file.mimetype,
            fieldname: file.fieldname,
            /* status: 'upload', */
          };
        });

        /*         console.log('uploadDocuments - documentInfo:', updatedDocumentInfo); */

        // Incluye los datos del usuario en la respuesta
        const data = {
          user: savedUser,
          documents: updatedDocumentInfo,
        };

        req.app.io.emit('newDocument', data);
        req.app.io.emit('newStatus', data);
        return res.sendSuccess({ message: 'Documentos subidos correctamente', payload: data });
      } else {
        /*         console.log('Documento no encontrado en la base de datos'); */
        return res.sendServerError('Error al subir documentos');
      }
    } catch (error) {
      return res.sendServerError('Error al subir documentos');
    }
  };

  /*   ************************************************************* */
  deleteDocumentById = async (uid, did, res, req) => {
    try {
      // Find the user by UID
      const user = await usersServices.findById(uid);
      if (!user) {
        return res.sendNotFound('Usuario no encontrado');
      }

      // Find the document index in the user's documents array
      const documentIndex = user.documents.findIndex((doc) => doc._id.toString() === did);

      if (documentIndex === -1) {
        return res.sendNotFound('Documento no encontrado');
      }

      // Remove the document from the user's documents array
      const deletedDocument = user.documents.splice(documentIndex, 1)[0]; // Get the deleted document

      // Check if there are no remaining documents
      if (user.documents.length === 0) {
        user.documents_status = 'pending';
      }
      const hasIdentificacion = user.documents.some((doc) => doc.fieldname === 'identificacion');
      const hasComprobanteDeDomicilio = user.documents.some((doc) => doc.fieldname === 'comprobanteDeDomicilio');
      const hasComprobanteDeEstadoDeCuenta = user.documents.some((doc) => doc.fieldname === 'comprobanteDeEstadoDeCuenta');

      if (!hasIdentificacion || !hasComprobanteDeDomicilio || !hasComprobanteDeEstadoDeCuenta) {
        user.premium_documents_status = 'pending'; // Deja el estado como 'pending'
      }

      // Save the updated user in the database
      await user.save();

      const data = {
        deletedDocumentID: deletedDocument._id,
        remainingDocuments: user.documents,
        user: user, // Agregar el usuario completo a la respuesta
      };

      req.app.io.emit('newStatus', data);
      return res.sendSuccess({
        message: 'Documento eliminado del usuario correctamente',
        payload: data,
      });
    } catch (error) {
      return res.sendServerError('Error al eliminar el documento');
    }
  };

  /*   ************************************************************* */
}

module.exports = new UsersServices();

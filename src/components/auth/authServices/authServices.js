/* ************************************************************************** */
/* /src/components/auth/authServices/authServices.js -  servicios de los usuarios. */
/* ************************************************************************** */
const { User } = require('../../../models/users');
const JWTService = require('../../../utils/jwt/jwt');
const jwt = require('jsonwebtoken');
const { createHash, isValidPassword } = require('../../../utils/bcrypt/bcrypt');
const { Cart } = require('../../../models/carts');
const { config } = require('../../../config');
/* Repository */
const { cartsServices } = require('../../../repositories/index');
const { usersServices } = require('../../../repositories/index');
/*  Importar el objeto req configurado con el middleware para utilizar logger 
antes de la inicialización de la app */
const req = require('../../../utils/logger/loggerSetup');

class AuthServices {
  constructor() {
    this.createUsersIfNotExists();
  }
  createUsersIfNotExists = async () => {
    const usersToCreate = [
      { email: 'admin@correo.com', firstName: 'admin', role: 'admin' },
      { email: 'user@correo.com', firstName: 'user', role: 'user' },
      { email: 'premium@correo.com', firstName: 'premium', role: 'premium' },
    ];

    for (const userData of usersToCreate) {
      const { email, firstName, role } = userData;
      const existingUser = await usersServices.findOne({ email });

      if (!existingUser) {
        const newUser = new User({
          first_name: firstName,
          last_name: firstName,
          email,
          age: 0,
          password: createHash('1111'),
          role,
        });

        try {
          const savedUser = await usersServices.createUserDTO(newUser);

          const userCart = new Cart({
            user: savedUser._id,
            products: [],
          });

          await cartsServices.save(userCart);

          savedUser.cart = userCart._id;
          // Actualiza la propiedad "last_connection" al registrar un nuevo usuario
          savedUser.last_connection = new Date();
          await savedUser.save();

          const token = await JWTService.generateJwt({ id: savedUser._id });

          await usersServices.findByIdAndUpdate(savedUser._id, { token }, { new: true });

          req.logger.info(`Usuario "${firstName} Role: ${role}" creado con éxito. Register for Testing last_connection -> new: ${savedUser.last_connection}`);
        } catch (error) {
          /*           req.logger.error(`Error al crear el usuario "${firstName}".`, error); */
        }
      }
    }
  };
  /* ///////////////////////////////////// */
  /* ///////////////////////////////////// */
  /* Jwt */
  register = async (req, payload, res) => {
    try {
      const { first_name, last_name, email, age, password, role } = payload;

      if (!first_name || !last_name || !email || !age || !password) {
        return res.sendServerError('Faltan campos obligatorios');
      }

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

      const savedUser = await usersServices.createUserDTO(newUser);

      const userCart = new Cart({
        user: savedUser._id,
        products: [],
      });

      await cartsServices.save(userCart);

      savedUser.cart = userCart._id;

      // Actualiza la propiedad "last_connection" al registrar un nuevo usuario
      savedUser.last_connection = new Date();
      await savedUser.save();

      const data = newUser;
      const token = await JWTService.generateJwt({ id: savedUser._id });

      await usersServices.findByIdAndUpdate(savedUser._id, { token }, { new: true });

      req.logger.info(`Usuario "${first_name}" creado con éxito. Register last_connection -> new: ${savedUser.last_connection}`);

      return res.sendCreated({
        payload: {
          message: 'Usuario agregado correctamente',
          token,
          data,
        },
      });
    } catch (error) {
      req.logger.error('Error al agregar el usuario');
      return res.sendServerError('Error al agregar el usuario');
    }
  };

  login = async (req, { email, password, isAdminLogin }) => {
    try {
      if (isAdminLogin) {
        const adminUser = {
          email: config.admin_email,
          admin: true,
          role: 'admin',
        };
        return { status: 200, success: true, response: adminUser, isAdminLogin: true };
      } else {
        let user = await usersServices.findOne({ email: email });
        if (!user) {
          req.logger.debug('El usuario no existe en la base de datos');
          return { status: 401, success: false, response: 'El usuario no existe en la base de datos!' };
        }

        if (!isValidPassword(password, user)) {
          req.logger.debug('Credenciales inválidas');
          return { status: 403, success: false, response: 'Credenciales inválidas' };
        }

        req.logger.debug('Login jwt success');
        // Almacena el valor anterior de "last_connection"
        const previousLastConnection = user.last_connection;

        // Actualiza la propiedad "last_connection" al iniciar sesión
        user.last_connection = new Date();
        await user.save();

        req.logger.debug(`Login last_connection -> previous: ${previousLastConnection.toISOString()} -> new: ${user.last_connection.toISOString()}`);

        return { status: 200, success: true, response: user, isAdminLogin: false };
      }
    } catch (error) {
      req.logger.error('Error en el servidor durante el login');
      return { status: 500, success: false, response: 'Error en el servidor durante el login' };
    }
  };

  current = async (req, res) => {
    try {
      const cookie = req.cookies['jwt'];

      if (!cookie) {
        return res.sendUnauthorized('Token no proporcionado');
      }

      const user = jwt.verify(cookie, config.jwt_secret);

      const data = user;
      return res.sendSuccess({
        payload: {
          message: 'Token obtenido correctamente',
          data,
        },
      });
    } catch (error) {
      return res.sendUnauthorized('Token no válido');
    }
  };

  logout = async (req, res) => {
    try {
      res.clearCookie('jwt');
      await new Promise((resolve, reject) => {
        req.session.destroy((err) => {
          if (err) {
            const response = { status: 500, success: false, error: err };
            req.logoutResult = response;
            reject(response);
          } else {
            const response = { status: 200, success: true, message: 'Logout exitoso' };
            req.logoutResult = response;
            resolve(response);
          }
          req.logger.debug('Logout success');
        });
      });

      if (req.user.email !== config.admin_email) {
        // Solo actualiza la propiedad "last_connection" si el usuario no es el administrador
        const user = await usersServices.findById(req.user._id);
        // Almacena el valor anterior de "last_connection"
        const previousLastConnection = user.last_connection;

        // Actualiza la propiedad "last_connection" al iniciar sesión
        user.last_connection = new Date();
        await user.save();

        req.logger.debug(`Logout last_connection -> previous: ${previousLastConnection.toISOString()} -> new: ${user.last_connection.toISOString()}`);
      }

      return req.logoutResult;
    } catch (err) {
      req.logger.error('Error durante el logout');
      const response = { status: 500, success: false, error: 'Error durante el logout' };
      req.logoutResult = response;
      return response;
    }
  };
}

module.exports = new AuthServices();

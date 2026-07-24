// server.js
// Backend + Frontend de SmartCampusGuide con Express y PostgreSQL

const express = require('express');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const path = require('path');
const QRCode = require('qrcode');   // NUEVO
const cron = require('node-cron');  // NUEVO

const app = express();
app.use(express.json());

// ---------------- CONFIGURACIÓN FRONTEND ----------------
app.use(express.static(path.join(__dirname, 'web')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

// ---------------- CONFIGURACIÓN POSTGRES ----------------
const pool = new Pool({
  user: 'campus_admin',
  host: 'localhost',
  database: 'smartcampus',
  password: 'piangel',
  port: 5432,
});
// ---------------- LOGIN ----------------
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query(
      'SELECT id_usuario, username, password_hash, rol FROM usuarios WHERE username = $1',
      [username]
    );
    if (result.rows.length === 0) return res.status(401).json({ message: 'Usuario no encontrado' });

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return res.status(401).json({ message: 'Contraseña incorrecta' });

    res.json({ message: 'Login exitoso', usuario: user.username, rol: user.rol });
  } catch (err) {
    console.error('Error en consulta:', err);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// ---------------- USUARIOS CRUD ----------------
app.get('/usuarios', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM usuarios ORDER BY id_usuario');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM usuarios WHERE id_usuario=$1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/usuarios', async (req, res) => {
  try {
    const { nombre, correo, rol } = req.body;
    const result = await pool.query(
      'INSERT INTO usuarios (nombre, correo, rol) VALUES ($1, $2, $3) RETURNING *',
      [nombre, correo, rol]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, correo, rol } = req.body;
    const result = await pool.query(
      'UPDATE usuarios SET nombre=$1, correo=$2, rol=$3 WHERE id_usuario=$4 RETURNING *',
      [nombre, correo, rol, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM usuarios WHERE id_usuario=$1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ message: 'Usuario eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ---------------- PROFESORES CRUD ----------------
app.get('/profesores', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         p.id_profesor AS id,
         u.nombre AS nombre,
         u.correo AS email,
         p.departamento,
         p.carrera,
         p.asignaturas
       FROM profesores p
       JOIN usuarios u ON p.id_usuario = u.id_usuario
       ORDER BY p.id_profesor`
    );
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/profesores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT
         p.id_profesor AS id,
         u.nombre AS nombre,
         u.correo AS email,
         p.departamento
       FROM profesores p
       JOIN usuarios u ON p.id_usuario = u.id_usuario
       WHERE p.id_profesor=$1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Profesor no encontrado' });
    res.json({ data: [result.rows[0]] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/profesores', async (req, res) => {
  try {
    const { id_usuario, departamento } = req.body;
    const insert = await pool.query(
      `INSERT INTO profesores (id_usuario, departamento)
       VALUES ($1, $2)
       RETURNING id_profesor`,
      [id_usuario, departamento]
    );

    const id_profesor = insert.rows[0].id_profesor;

    const result = await pool.query(
      `SELECT
         p.id_profesor AS id,
         u.nombre AS nombre,
         u.correo AS email,
         p.departamento
       FROM profesores p
       JOIN usuarios u ON p.id_usuario = u.id_usuario
       WHERE p.id_profesor=$1`,
      [id_profesor]
    );

    res.json({ data: [result.rows[0]] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/profesores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { id_usuario, departamento } = req.body;

    await pool.query(
      `UPDATE profesores
       SET id_usuario=$1, departamento=$2
       WHERE id_profesor=$3`,
      [id_usuario, departamento, id]
    );

    const result = await pool.query(
      `SELECT
         p.id_profesor AS id,
         u.nombre AS nombre,
         u.correo AS email,
         p.departamento
       FROM profesores p
       JOIN usuarios u ON p.id_usuario = u.id_usuario
       WHERE p.id_profesor=$1`,
      [id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Profesor no encontrado' });
    res.json({ data: [result.rows[0]] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/profesores/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
         p.id_profesor AS id,
         u.nombre AS nombre,
         u.correo AS email,
         p.departamento
       FROM profesores p
       JOIN usuarios u ON p.id_usuario = u.id_usuario
       WHERE p.id_profesor=$1`,
      [id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Profesor no encontrado' });

    await pool.query(`DELETE FROM profesores WHERE id_profesor=$1`, [id]);

    res.json({ data: [result.rows[0]] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ---------------- ESTUDIANTES CRUD ----------------
app.get('/estudiantes', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         e.id_estudiante AS id,
         u.nombre,
         u.correo,
         e.matricula,
         e.id_usuario
       FROM estudiantes e
       JOIN usuarios u ON e.id_usuario = u.id_usuario
       ORDER BY e.id_estudiante`
    );
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/estudiantes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT
         e.id_estudiante AS id,
         u.nombre,
         u.correo,
         e.matricula,
         e.id_usuario
       FROM estudiantes e
       JOIN usuarios u ON e.id_usuario = u.id_usuario
       WHERE e.id_estudiante=$1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Estudiante no encontrado' });
    res.json({ data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/estudiantes', async (req, res) => {
  try {
    const { id_usuario, matricula } = req.body;
    const result = await pool.query(
      `INSERT INTO estudiantes (id_usuario, matricula)
       VALUES ($1, $2)
       RETURNING id_estudiante AS id, id_usuario, matricula`,
      [id_usuario, matricula]
    );
    res.json({ data: result.rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/estudiantes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { id_usuario, matricula } = req.body;
    const result = await pool.query(
      `UPDATE estudiantes
       SET id_usuario=$1, matricula=$2
       WHERE id_estudiante=$3
       RETURNING id_estudiante AS id, id_usuario, matricula`,
      [id_usuario, matricula, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Estudiante no encontrado' });
    res.json({ data: result.rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/estudiantes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM estudiantes
       WHERE id_estudiante=$1
       RETURNING id_estudiante AS id, id_usuario, matricula`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Estudiante no encontrado' });
    res.json({ mensaje: 'Estudiante eliminado correctamente', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// ---------------- QR Y ASISTENCIA ----------------

// Generar QR para un aula
app.post('/aulas/:id/generar_qr', async (req, res) => {
  const { id } = req.params;
  const codigoQR = Math.random().toString(36).substring(2, 10);
  await pool.query('UPDATE aulas SET codigo_qr = $1 WHERE id_aula = $2', [codigoQR, id]);
  const qrImage = await QRCode.toDataURL(codigoQR);
  res.json({ aula: id, codigo_qr: codigoQR, qr_image: qrImage });
});

// Obtener QR actual de un aula
app.get('/aulas/:id/qr', async (req, res) => {
  const { id } = req.params;
  const result = await pool.query('SELECT codigo_qr FROM aulas WHERE id_aula = $1', [id]);
  if (!result.rows.length) return res.status(404).json({ error: 'Aula no encontrada' });
  const codigoQR = result.rows[0].codigo_qr;
  const qrImage = await QRCode.toDataURL(codigoQR);
  res.json({ aula: id, codigo_qr: codigoQR, qr_image: qrImage });
});

// Registrar asistencia profesor
app.post('/asistencia_profesores', async (req, res) => {
  const { id_profesor, id_aula, id_asignatura, estado, codigo_qr } = req.body;
  const result = await pool.query('SELECT codigo_qr FROM aulas WHERE id_aula = $1', [id_aula]);
  if (!result.rows.length || result.rows[0].codigo_qr !== codigo_qr) {
    return res.status(400).json({ error: 'QR inválido' });
  }
  await pool.query(
    `INSERT INTO asistencia_profesores (id_profesor, id_aula, id_asignatura, estado, codigo_qr) 
     VALUES ($1, $2, $3, $4, $5)`,
    [id_profesor, id_aula, id_asignatura, estado, codigo_qr]
  );
  res.json({ message: 'Asistencia registrada' });
});









// ---------------- CRON JOB SEMANAL ----------------
// Cada lunes a las 8 AM se generan nuevos QR para todas las aulas
cron.schedule('0 8 * * MON', async () => {
  try {
    const aulas = await pool.query('SELECT id_aula FROM aulas');
    for (const aula of aulas.rows) {
      const codigoQR = Math.random().toString(36).substring(2, 10);
      await pool.query('UPDATE aulas SET codigo_qr = $1 WHERE id_aula = $2', [codigoQR, aula.id_aula]);
      console.log(`Nuevo QR generado para aula ${aula.id_aula}: ${codigoQR}`);
    }
  } catch (err) {
    console.error('Error generando QR semanal:', err);
  }
});




// Crear usuario con contraseña encriptada
app.post("/usuarios", async (req, res) => {
  const { nombre, correo, rol, password } = req.body;
  try {
    // Generar hash seguro de la contraseña
    const passwordHash = bcrypt.hashSync(password, 10);

    const result = await pool.query(
      "INSERT INTO usuarios (nombre, correo, rol, password_hash) VALUES ($1, $2, $3, $4) RETURNING *",
      [nombre, correo, rol, passwordHash]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// Editar usuario con opción de actualizar contraseña
app.put("/usuarios/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, correo, rol, password } = req.body;

  try {
    let result;

    if (password && password.trim() !== "") {
      // Si se envía nueva contraseña, la encriptamos
      const passwordHash = bcrypt.hashSync(password, 10);
      result = await pool.query(
        "UPDATE usuarios SET nombre=$1, correo=$2, rol=$3, password_hash=$4 WHERE id_usuario=$5 RETURNING *",
        [nombre, correo, rol, passwordHash, id]
      );
    } else {
      // Si no se envía contraseña, no la tocamos
      result = await pool.query(
        "UPDATE usuarios SET nombre=$1, correo=$2, rol=$3 WHERE id_usuario=$4 RETURNING *",
        [nombre, correo, rol, id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



app.post("/login", async (req, res) => {
  const { correo, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM usuarios WHERE correo=$1", [correo]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }

    const usuario = result.rows[0];
    const valido = bcrypt.compareSync(password, usuario.password_hash);

    if (!valido) {
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    res.json({ mensaje: "Login correcto", usuario });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Crear profesor
app.post('/profesores', async (req, res) => {
  const { id_usuario, departamento, carrera, asignaturas } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO profesores (id_usuario, departamento, carrera, asignaturas)
       VALUES ($1, $2, $3, $4)
       RETURNING id_profesor AS id, id_usuario, departamento, carrera, asignaturas`,
      [id_usuario, departamento, carrera, asignaturas]
    );
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar profesor
app.put('/profesores/:id', async (req, res) => {
  const { id } = req.params; // corresponde a id_profesor
  const { id_usuario, departamento, carrera, asignaturas } = req.body;
  try {
    const result = await pool.query(
      `UPDATE profesores
       SET id_usuario=$1, departamento=$2, carrera=$3, asignaturas=$4
       WHERE id_profesor=$5
       RETURNING id_profesor AS id, id_usuario, departamento, carrera, asignaturas`,
      [id_usuario, departamento, carrera, asignaturas, id]
    );
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




// Obtener profesores
app.get("/profesores", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.id_profesor AS id,
             u.nombre,
             u.correo AS email,
             p.departamento,
             p.carrera,
             p.asignaturas
      FROM profesores p
      JOIN usuarios u ON p.id_usuario = u.id_usuario
    `);
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Obtener profesor por ID
app.get("/profesores/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT p.id_profesor AS id,
             u.nombre,
             u.correo AS email,
             p.departamento,
             p.carrera,
             p.asignaturas
      FROM profesores p
      JOIN usuarios u ON p.id_usuario = u.id_usuario
      WHERE p.id_profesor = $1
    `, [id]);
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// Eliminar profesor
app.delete('/profesores/:id', async (req, res) => {
  const { id } = req.params; // corresponde a id_profesor
  try {
    const result = await pool.query(
      `DELETE FROM profesores
       WHERE id_profesor = $1
       RETURNING id_profesor AS id, id_usuario, departamento, carrera, asignaturas`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Profesor no encontrado" });
    }

    res.json({ mensaje: "Profesor eliminado correctamente", data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('SmartCampusGuide funcionando en Render 🚀');
});

// ---------------- INICIO SERVIDOR ----------------
// Render asigna el puerto automáticamente
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});



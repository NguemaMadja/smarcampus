// server.js
// Backend + Frontend de SmartCampusGuide con Express y PostgreSQL

const express = require('express');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const path = require('path');
const QRCode = require('qrcode');
const cron = require('node-cron');

const app = express();
app.use(express.json());

// ---------------- CONFIGURACIÓN FRONTEND ----------------
app.use(express.static(path.join(__dirname, 'web')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

// ---------------- CONFIGURACIÓN POSTGRES ----------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://smartcampus_e3qk_user:VcilJQhBclQrE8dlUTEnOqQA3rUL1L1K@dpg-d9hstto4n6ts73bg0em0-a.oregon-postgres.render.com:5432/smartcampus_e3qk",
  ssl: { rejectUnauthorized: false }
});

// ---------------- LOGIN ----------------
app.post('/login', async (req, res) => {
  const { correo, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM usuarios WHERE correo=$1", [correo]);
    if (result.rows.length === 0) return res.status(401).json({ error: "Usuario no encontrado" });

    const usuario = result.rows[0];
    const valido = bcrypt.compareSync(password, usuario.password_hash);
    if (!valido) return res.status(401).json({ error: "Contraseña incorrecta" });

    res.json({ mensaje: "Login correcto", usuario });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

app.post("/usuarios", async (req, res) => {
  const { nombre, correo, rol, password } = req.body;
  try {
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

app.put("/usuarios/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, correo, rol, password } = req.body;
  try {
    let result;
    if (password && password.trim() !== "") {
      const passwordHash = bcrypt.hashSync(password, 10);
      result = await pool.query(
        "UPDATE usuarios SET nombre=$1, correo=$2, rol=$3, password_hash=$4 WHERE id_usuario=$5 RETURNING *",
        [nombre, correo, rol, passwordHash, id]
      );
    } else {
      result = await pool.query(
        "UPDATE usuarios SET nombre=$1, correo=$2, rol=$3 WHERE id_usuario=$4 RETURNING *",
        [nombre, correo, rol, id]
      );
    }
    if (result.rows.length === 0) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
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

// Obtener todos los profesores con sus departamentos, carreras y asignaturas
app.get('/profesores', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.id_profesor AS id,
             u.nombre,
             u.correo,
             COALESCE(STRING_AGG(DISTINCT d.nombre, ', '), '') AS departamentos,
             COALESCE(STRING_AGG(DISTINCT c.nombre, ', '), '') AS carreras,
             COALESCE(STRING_AGG(DISTINCT a.nombre, ', '), '') AS asignaturas
      FROM profesores p
      JOIN usuarios u ON p.id_usuario = u.id_usuario
      LEFT JOIN profesor_departamento pd ON p.id_profesor = pd.id_profesor
      LEFT JOIN departamentos d ON pd.id_departamento = d.id_departamento
      LEFT JOIN profesor_carrera pc ON p.id_profesor = pc.id_profesor
      LEFT JOIN carreras c ON pc.id_carrera = c.id_carrera
      LEFT JOIN profesor_asignatura pa ON p.id_profesor = pa.id_profesor
      LEFT JOIN asignaturas a ON pa.id_asignatura = a.id_asignatura
      GROUP BY p.id_profesor, u.nombre, u.correo
      ORDER BY p.id_profesor;
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Obtener un profesor por ID
app.get('/profesores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT p.id_profesor AS id,
             u.nombre,
             u.correo,
             u.rol,
             COALESCE(STRING_AGG(DISTINCT d.nombre, ', '), '') AS departamentos,
             COALESCE(STRING_AGG(DISTINCT c.nombre, ', '), '') AS carreras,
             COALESCE(STRING_AGG(DISTINCT a.nombre, ', '), '') AS asignaturas
      FROM profesores p
      JOIN usuarios u ON p.id_usuario = u.id_usuario
      LEFT JOIN profesor_departamento pd ON p.id_profesor = pd.id_profesor
      LEFT JOIN departamentos d ON pd.id_departamento = d.id_departamento
      LEFT JOIN profesor_carrera pc ON p.id_profesor = pc.id_profesor
      LEFT JOIN carreras c ON pc.id_carrera = c.id_carrera
      LEFT JOIN profesor_asignatura pa ON p.id_profesor = pa.id_profesor
      LEFT JOIN asignaturas a ON pa.id_asignatura = a.id_asignatura
      WHERE p.id_profesor=$1
      GROUP BY p.id_profesor, u.nombre, u.correo, u.rol
    `, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Profesor no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear un profesor
app.post('/profesores', async (req, res) => {
  try {
    const { id_usuario, departamentos, carreras, asignaturas } = req.body;

    // Insertar profesor (ya no usamos columna departamento)
    const result = await pool.query(
      `INSERT INTO profesores (id_usuario)
       VALUES ($1) RETURNING id_profesor AS id`,
      [id_usuario]
    );
    const profesorId = result.rows[0].id;

    // Insertar relaciones si vienen en el body
    if (departamentos && departamentos.length > 0) {
      for (const depId of departamentos) {
        await pool.query(
          `INSERT INTO profesor_departamento (id_profesor, id_departamento) VALUES ($1, $2)`,
          [profesorId, depId]
        );
      }
    }
    if (carreras && carreras.length > 0) {
      for (const carId of carreras) {
        await pool.query(
          `INSERT INTO profesor_carrera (id_profesor, id_carrera) VALUES ($1, $2)`,
          [profesorId, carId]
        );
      }
    }
    if (asignaturas && asignaturas.length > 0) {
      for (const asigId of asignaturas) {
        await pool.query(
          `INSERT INTO profesor_asignatura (id_profesor, id_asignatura) VALUES ($1, $2)`,
          [profesorId, asigId]
        );
      }
    }

    res.json({ mensaje: 'Profesor creado correctamente', id: profesorId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Actualizar un profesor
app.put('/profesores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { id_usuario, departamentos, carreras, asignaturas } = req.body;

    // Actualizar profesor
    await pool.query(
      `UPDATE profesores SET id_usuario=$1 WHERE id_profesor=$2`,
      [id_usuario, id]
    );

    // Limpiar relaciones previas
    await pool.query(`DELETE FROM profesor_departamento WHERE id_profesor=$1`, [id]);
    await pool.query(`DELETE FROM profesor_carrera WHERE id_profesor=$1`, [id]);
    await pool.query(`DELETE FROM profesor_asignatura WHERE id_profesor=$1`, [id]);

    // Insertar nuevas relaciones
    if (departamentos && departamentos.length > 0) {
      for (const depId of departamentos) {
        await pool.query(
          `INSERT INTO profesor_departamento (id_profesor, id_departamento) VALUES ($1, $2)`,
          [id, depId]
        );
      }
    }
    if (carreras && carreras.length > 0) {
      for (const carId of carreras) {
        await pool.query(
          `INSERT INTO profesor_carrera (id_profesor, id_carrera) VALUES ($1, $2)`,
          [id, carId]
        );
      }
    }
    if (asignaturas && asignaturas.length > 0) {
      for (const asigId of asignaturas) {
        await pool.query(
          `INSERT INTO profesor_asignatura (id_profesor, id_asignatura) VALUES ($1, $2)`,
          [id, asigId]
        );
      }
    }

    res.json({ mensaje: 'Profesor actualizado correctamente', id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Eliminar un profesor
app.delete('/profesores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM profesores WHERE id_profesor=$1 RETURNING id_profesor AS id`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Profesor no encontrado' });
    res.json({ mensaje: 'Profesor eliminado correctamente', id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});





// ---------------- ESTUDIANTES CRUD ----------------
app.get('/estudiantes', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.id_estudiante AS id,
             u.nombre,
             u.correo,
             e.matricula,
             e.id_usuario
      FROM estudiantes e
      JOIN usuarios u ON e.id_usuario = u.id_usuario
      ORDER BY e.id_estudiante
    `);
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/estudiantes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT e.id_estudiante AS id,
             e.id_usuario,
             e.matricula,
             u.nombre,
             u.correo
      FROM estudiantes e
      JOIN usuarios u ON e.id_usuario = u.id_usuario
      WHERE e.id_estudiante=$1
    `, [id]);
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

// ---------------- INICIO SERVIDOR ----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

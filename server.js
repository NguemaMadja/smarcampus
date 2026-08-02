// server.js
// Backend + Frontend de SmartCampusGuide con Express y PostgreSQL

const express = require('express');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const path = require('path');
const QRCode = require('qrcode');
const cron = require('node-cron');
const cors = require('cors');

const app = express();
app.use(express.json());

// ---------------- CONFIGURACIÓN CORS ----------------
app.use(cors({
  origin: "https://smarcampus.onrender.com"
}));

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
             COALESCE(STRING_AGG(DISTINCT a.nombre, ', '), '') AS asignaturas,
             ARRAY_REMOVE(ARRAY_AGG(DISTINCT d.id_departamento), NULL) AS departamentos_ids,
             ARRAY_REMOVE(ARRAY_AGG(DISTINCT c.id_carrera), NULL) AS carreras_ids,
             ARRAY_REMOVE(ARRAY_AGG(DISTINCT a.id_asignatura), NULL) AS asignaturas_ids
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
             COALESCE(STRING_AGG(DISTINCT d.nombre, ', '), '') AS departamentos,
             COALESCE(STRING_AGG(DISTINCT c.nombre, ', '), '') AS carreras,
             COALESCE(STRING_AGG(DISTINCT a.nombre, ', '), '') AS asignaturas,
             ARRAY_REMOVE(ARRAY_AGG(DISTINCT d.id_departamento), NULL) AS departamentos_ids,
             ARRAY_REMOVE(ARRAY_AGG(DISTINCT c.id_carrera), NULL) AS carreras_ids,
             ARRAY_REMOVE(ARRAY_AGG(DISTINCT a.id_asignatura), NULL) AS asignaturas_ids
      FROM profesores p
      JOIN usuarios u ON p.id_usuario = u.id_usuario
      LEFT JOIN profesor_departamento pd ON p.id_profesor = pd.id_profesor
      LEFT JOIN departamentos d ON pd.id_departamento = d.id_departamento
      LEFT JOIN profesor_carrera pc ON p.id_profesor = pc.id_profesor
      LEFT JOIN carreras c ON pc.id_carrera = c.id_carrera
      LEFT JOIN profesor_asignatura pa ON p.id_profesor = pa.id_profesor
      LEFT JOIN asignaturas a ON pa.id_asignatura = a.id_asignatura
      WHERE p.id_profesor=$1
      GROUP BY p.id_profesor, u.nombre, u.correo
    `, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Profesor no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear profesor
app.post('/profesores', async (req, res) => {
  try {
    const { id_usuario, departamentos_ids, carreras_ids, asignaturas_ids } = req.body;
    const result = await pool.query(
      'INSERT INTO profesores (id_usuario) VALUES ($1) RETURNING id_profesor',
      [id_usuario]
    );
    const profesorId = result.rows[0].id_profesor;

    if (departamentos_ids?.length) {
      for (const depId of departamentos_ids) {
        await pool.query('INSERT INTO profesor_departamento (id_profesor, id_departamento) VALUES ($1, $2)', [profesorId, depId]);
      }
    }
    if (carreras_ids?.length) {
      for (const carId of carreras_ids) {
        await pool.query('INSERT INTO profesor_carrera (id_profesor, id_carrera) VALUES ($1, $2)', [profesorId, carId]);
      }
    }
    if (asignaturas_ids?.length) {
      for (const asigId of asignaturas_ids) {
        await pool.query('INSERT INTO profesor_asignatura (id_profesor, id_asignatura) VALUES ($1, $2)', [profesorId, asigId]);
      }
    }

    res.json({ mensaje: 'Profesor creado correctamente', id: profesorId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Actualizar profesor
app.put('/profesores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { id_usuario, departamentos_ids, carreras_ids, asignaturas_ids } = req.body;

    await pool.query('UPDATE profesores SET id_usuario=$1 WHERE id_profesor=$2', [id_usuario, id]);

    await pool.query('DELETE FROM profesor_departamento WHERE id_profesor=$1', [id]);
    await pool.query('DELETE FROM profesor_carrera WHERE id_profesor=$1', [id]);
    await pool.query('DELETE FROM profesor_asignatura WHERE id_profesor=$1', [id]);

    if (departamentos_ids?.length) {
      for (const depId of departamentos_ids) {
        await pool.query('INSERT INTO profesor_departamento (id_profesor, id_departamento) VALUES ($1, $2)', [id, depId]);
      }
    }
    if (carreras_ids?.length) {
      for (const carId of carreras_ids) {
        await pool.query('INSERT INTO profesor_carrera (id_profesor, id_carrera) VALUES ($1, $2)', [id, carId]);
      }
    }
    if (asignaturas_ids?.length) {
      for (const asigId of asignaturas_ids) {
        await pool.query('INSERT INTO profesor_asignatura (id_profesor, id_asignatura) VALUES ($1, $2)', [id, asigId]);
      }
    }

    res.json({ mensaje: 'Profesor actualizado correctamente', id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Eliminar profesor
app.delete('/profesores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM profesor_departamento WHERE id_profesor=$1', [id]);
    await pool.query('DELETE FROM profesor_carrera WHERE id_profesor=$1', [id]);
    await pool.query('DELETE FROM profesor_asignatura WHERE id_profesor=$1', [id]);
    const result = await pool.query('DELETE FROM profesores WHERE id_profesor=$1 RETURNING id_profesor', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Profesor no encontrado' });
    res.json({ mensaje: 'Profesor eliminado correctamente', id: result.rows[0].id_profesor });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ---------------- ESTUDIANTES CRUD ----------------

// Obtener todos los estudiantes
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

// Obtener un estudiante por ID
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

// Crear estudiante
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

// Actualizar estudiante
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

// Eliminar estudiante
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


// ---------------- ESTADÍSTICAS ----------------

// Usuarios por rol
app.get('/usuarios_estadisticas', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT rol, COUNT(*) AS total
      FROM usuarios
      GROUP BY rol
      ORDER BY rol
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Visitas de la aplicación
app.get('/visitas_app', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DATE(fecha) AS fecha, COUNT(*) AS total
      FROM visitasapp
      GROUP BY DATE(fecha)
      ORDER BY DATE(fecha)
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Asistencia de estudiantes/profesores
app.get('/asistencia_estadisticas', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.id_asignatura, COUNT(*) AS asistencias
      FROM asistencia a
      GROUP BY a.id_asignatura
      ORDER BY asistencias DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Navegación en el mapa (acciones registradas)
app.get('/mapa_estadisticas', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT accion AS zona, COUNT(*) AS total
      FROM logsactividad
      GROUP BY accion
      ORDER BY total DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Oyentes de Radio UNGE
app.get('/oyentes_radio', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.titulo_programa AS programa, COUNT(e.usuario_id) AS oyentes
      FROM estadisticas_escucha e
      JOIN radiounge r ON e.id_programa = r.id
      GROUP BY r.titulo_programa
      ORDER BY oyentes DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Condiciones ambientales
app.get('/sensores_estadisticas', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DATE(fecha) AS fecha,
             AVG(valor) FILTER (WHERE id_sensor IN (
               SELECT id_sensor FROM sensores WHERE tipo='temperatura'
             )) AS temperatura,
             AVG(valor) FILTER (WHERE id_sensor IN (
               SELECT id_sensor FROM sensores WHERE tipo='humedad'
             )) AS humedad,
             AVG(valor) FILTER (WHERE id_sensor IN (
               SELECT id_sensor FROM sensores WHERE tipo='co2'
             )) AS co2
      FROM medicionesambientales
      GROUP BY DATE(fecha)
      ORDER BY DATE(fecha)
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// QoS de la red WiFi
app.get('/qos_wifi', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DATE(fecha) AS fecha,
             AVG(latencia) AS latencia,
             AVG(jitter) AS jitter,
             AVG(ancho_banda) AS velocidad,
             AVG(nivel_senal) AS rssi,
             AVG(perdida_paquetes) AS perdida
      FROM metricaswifi
      GROUP BY DATE(fecha)
      ORDER BY DATE(fecha)
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




// ---------------- DEPARTAMENTOS CRUD ----------------
app.get('/departamentos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM departamentos ORDER BY id_departamento');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/departamentos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM departamentos WHERE id_departamento=$1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Departamento no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/departamentos', async (req, res) => {
  try {
    const { nombre } = req.body;
    const result = await pool.query(
      'INSERT INTO departamentos (nombre) VALUES ($1) RETURNING *',
      [nombre]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/departamentos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    const result = await pool.query(
      'UPDATE departamentos SET nombre=$1 WHERE id_departamento=$2 RETURNING *',
      [nombre, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Departamento no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/departamentos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM departamentos WHERE id_departamento=$1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Departamento no encontrado' });
    res.json({ mensaje: 'Departamento eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- CARRERAS CRUD ----------------
app.get('/carreras', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM carreras ORDER BY id_carrera');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/carreras/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM carreras WHERE id_carrera=$1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Carrera no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/carreras', async (req, res) => {
  try {
    const { nombre } = req.body;
    const result = await pool.query(
      'INSERT INTO carreras (nombre) VALUES ($1) RETURNING *',
      [nombre]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/carreras/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    const result = await pool.query(
      'UPDATE carreras SET nombre=$1 WHERE id_carrera=$2 RETURNING *',
      [nombre, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Carrera no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/carreras/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM carreras WHERE id_carrera=$1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Carrera no encontrada' });
    res.json({ mensaje: 'Carrera eliminada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ---------------- EDIFICIOS CRUD ----------------
app.get('/edificios', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id_edificio AS id, nombre, ubicacion, lat, lng FROM edificios ORDER BY id_edificio'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/edificios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id_edificio AS id, nombre, ubicacion, lat, lng FROM edificios WHERE id_edificio=$1',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Edificio no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/edificios', async (req, res) => {
  try {
    const { nombre, ubicacion, lat, lng } = req.body;
    const result = await pool.query(
      'INSERT INTO edificios (nombre, ubicacion, lat, lng) VALUES ($1, $2, $3, $4) RETURNING id_edificio AS id, nombre, ubicacion, lat, lng',
      [nombre, ubicacion, lat, lng]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/edificios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, ubicacion, lat, lng } = req.body;
    const result = await pool.query(
      'UPDATE edificios SET nombre=$1, ubicacion=$2, lat=$3, lng=$4 WHERE id_edificio=$5 RETURNING id_edificio AS id, nombre, ubicacion, lat, lng',
      [nombre, ubicacion, lat, lng, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Edificio no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/edificios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM edificios WHERE id_edificio=$1 RETURNING id_edificio AS id, nombre, ubicacion, lat, lng',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Edificio no encontrado' });
    res.json({ mensaje: 'Edificio eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// ---------------- MAPA: BÚSQUEDA Y HUELLA ----------------

// Buscar edificio por nombre
app.get('/api/map/search', async (req, res) => {
  try {
    const { nombre } = req.query;
    const result = await pool.query(
      "SELECT * FROM edificios WHERE nombre ILIKE $1 LIMIT 1",
      [nombre]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Edificio no encontrado" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Registrar huella de usuario
app.post('/api/map/huella', async (req, res) => {
  try {
    const { usuario_id, edificio_id } = req.body;
    const result = await pool.query(
      "INSERT INTO huella_usuarios (usuario_id, edificio_id, fecha_busqueda) VALUES ($1, $2, NOW()) RETURNING *",
      [usuario_id, edificio_id]
    );
    res.json({ mensaje: "Huella registrada", data: result.rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Marcar llegada y enviar mensaje
app.post('/api/map/arrived', async (req, res) => {
  try {
    const { usuario_id, edificio_id } = req.body;
    const result = await pool.query(
      "UPDATE huella_usuarios SET tiempo_llegada=NOW(), mensaje_enviado=TRUE WHERE usuario_id=$1 AND edificio_id=$2 RETURNING *",
      [usuario_id, edificio_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Huella no encontrada" });
    res.json({ mensaje: "Bienvenido al edificio!", data: result.rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});





// ---------------- ASIGNATURAS CRUD ----------------
app.get('/asignaturas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM asignaturas ORDER BY id_asignatura');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/asignaturas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM asignaturas WHERE id_asignatura=$1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Asignatura no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/asignaturas', async (req, res) => {
  try {
    const { nombre } = req.body;
    const result = await pool.query(
      'INSERT INTO asignaturas (nombre) VALUES ($1) RETURNING *',
      [nombre]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/asignaturas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    const result = await pool.query(
      'UPDATE asignaturas SET nombre=$1 WHERE id_asignatura=$2 RETURNING *',
      [nombre, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Asignatura no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/asignaturas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM asignaturas WHERE id_asignatura=$1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Asignatura no encontrada' });
    res.json({ mensaje: 'Asignatura eliminada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ---------------- TIPOS DE SENSORES CRUD ----------------
app.get('/tipos_sensores', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tipos_sensores ORDER BY id_tipo');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/tipos_sensores', async (req, res) => {
  try {
    const { nombre } = req.body;
    const result = await pool.query(
      'INSERT INTO tipos_sensores (nombre) VALUES ($1) RETURNING *',
      [nombre]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/tipos_sensores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM tipos_sensores WHERE id_tipo=$1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tipo no encontrado' });
    res.json({ mensaje: 'Tipo eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ---------------- AULAS CRUD ----------------

// Listar todas las aulas
app.get('/aulas', async (req, res) => {
  try {
    const result = await pool.query('SELECT id_aula, nombre FROM aulas ORDER BY id_aula');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear aula
app.post('/aulas', async (req, res) => {
  try {
    const { nombre } = req.body;
    const result = await pool.query(
      'INSERT INTO aulas (nombre) VALUES ($1) RETURNING *',
      [nombre]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Actualizar aula
app.put('/aulas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    const result = await pool.query(
      'UPDATE aulas SET nombre=$1 WHERE id_aula=$2 RETURNING *',
      [nombre, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Aula no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Eliminar aula
app.delete('/aulas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM aulas WHERE id_aula=$1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Aula no encontrada' });
    res.json({ message: 'Aula eliminada correctamente' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});





// ---------------- SENSORES CRUD ----------------
app.get('/sensores', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id_sensor,
             ts.nombre AS tipo,
             a.nombre AS aula,
             s.ubicacion,
             l.valor, l.fecha, l.hora
      FROM sensores s
      JOIN tipos_sensores ts ON s.id_tipo = ts.id_tipo
      JOIN aulas a ON s.id_aula = a.id_aula
      LEFT JOIN LATERAL (
        SELECT valor, fecha, hora
        FROM lecturas
        WHERE id_sensor = s.id_sensor
        ORDER BY fecha DESC, hora DESC
        LIMIT 1
      ) l ON true
      ORDER BY s.id_sensor
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post('/sensores', async (req, res) => {
  try {
    const { id_aula, id_tipo, ubicacion } = req.body;
    const result = await pool.query(
      'INSERT INTO sensores (id_aula, id_tipo, ubicacion) VALUES ($1, $2, $3) RETURNING *',
      [id_aula, id_tipo, ubicacion]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


app.put('/sensores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { id_aula, id_tipo, ubicacion } = req.body;
    const result = await pool.query(
      'UPDATE sensores SET id_aula=$1, id_tipo=$2, ubicacion=$3 WHERE id_sensor=$4 RETURNING *',
      [id_aula, id_tipo, ubicacion, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Sensor no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


app.delete('/sensores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM sensores WHERE id_sensor=$1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Sensor no encontrado' });
    res.json({ mensaje: 'Sensor eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ---------------- LECTURAS DE SENSORES ----------------
app.post('/sensores/data', async (req, res) => {
  try {
    const { id_sensor, valor } = req.body;
    const fecha = new Date().toISOString().split("T")[0];
    const hora = new Date().toISOString().split("T")[1].split(".")[0];

    const result = await pool.query(
      'INSERT INTO lecturas (id_sensor, valor, fecha, hora) VALUES ($1, $2, $3, $4) RETURNING *',
      [id_sensor, valor, fecha, hora]
    );
    res.json({ mensaje: 'Lectura registrada', data: result.rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


// ---------------- HISTORIAL DE SENSORES ----------------
app.get('/sensores/:id/historial', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT valor, fecha, hora
       FROM lecturas
       WHERE id_sensor = $1
       ORDER BY fecha ASC, hora ASC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error obteniendo historial:", err);
    res.status(500).json({ error: "Error al obtener historial del sensor" });
  }
});



// ---------------- QR Y ASISTENCIA ----------------

// Generar QR para un aula (semanal)
app.post('/aulas/:id/generar_qr', async (req, res) => {
  const { id } = req.params;
  const codigoQR = Math.random().toString(36).substring(2, 10);

  const fechaInicio = new Date();
  const fechaFin = new Date();
  fechaFin.setDate(fechaInicio.getDate() + 7);

  const result = await pool.query(
    `INSERT INTO aula_qr (id_aula, codigo_qr, fecha_inicio, fecha_fin)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [id, codigoQR, fechaInicio, fechaFin]
  );

  const qrImage = await QRCode.toDataURL(codigoQR);
  res.json({ aula: id, codigo_qr: codigoQR, qr_image: qrImage, registro: result.rows[0] });
});

// Obtener QR actual de un aula
app.get('/aulas/:id/qr', async (req, res) => {
  const { id } = req.params;
  const hoy = new Date();

  const result = await pool.query(
    `SELECT codigo_qr FROM aula_qr
     WHERE id_aula=$1 AND $2 BETWEEN fecha_inicio AND fecha_fin
     ORDER BY fecha_inicio DESC LIMIT 1`,
    [id, hoy]
  );

  if (!result.rows.length) return res.status(404).json({ error: 'QR no encontrado o vencido' });

  const codigoQR = result.rows[0].codigo_qr;
  const qrImage = await QRCode.toDataURL(codigoQR);
  res.json({ aula: id, codigo_qr: codigoQR, qr_image: qrImage });
});

// ---------------- ASISTENCIA PROFESORES ----------------

// Registrar asistencia profesor usando QR vigente
app.post('/asistencia_profesores', async (req, res) => {
  const { id_profesor, id_aula, estado, codigo_qr } = req.body;

  try {
    const hoy = new Date();
    const result = await pool.query(
      `SELECT id_qr, codigo_qr FROM aula_qr
       WHERE id_aula=$1 AND $2 BETWEEN fecha_inicio AND fecha_fin
       ORDER BY fecha_inicio DESC LIMIT 1`,
      [id_aula, hoy]
    );

    if (!result.rows.length || result.rows[0].codigo_qr !== codigo_qr) {
      return res.status(400).json({ error: 'QR inválido o vencido' });
    }

    const id_qr = result.rows[0].id_qr;

    await pool.query(
      `INSERT INTO asistencias_profesores (id_profesor, id_qr, estado)
       VALUES ($1, $2, $3)`,
      [id_profesor, id_qr, estado]
    );

    res.json({ message: 'Asistencia registrada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- CRON JOB SEMANAL ----------------
// Generar un nuevo QR semanal para cada aula
cron.schedule('0 8 * * MON', async () => {
  try {
    const aulas = await pool.query('SELECT id_aula FROM aulas');
    for (const aula of aulas.rows) {
      const codigoQR = Math.random().toString(36).substring(2, 10);
      const fechaInicio = new Date();
      const fechaFin = new Date();
      fechaFin.setDate(fechaInicio.getDate() + 7);

      await pool.query(
        `INSERT INTO aula_qr (id_aula, codigo_qr, fecha_inicio, fecha_fin)
         VALUES ($1, $2, $3, $4)`,
        [aula.id_aula, codigoQR, fechaInicio, fechaFin]
      );

      console.log(`Nuevo QR generado para aula ${aula.id_aula}: ${codigoQR}`);
    }
  } catch (err) {
    console.error('Error generando QR semanal:', err);
  }
});


// Métricas WiFi - listado con filtros opcionales
app.get('/metricaswifi', async (req, res) => {
  try {
    const { fechaInicio, fechaFin, idAula } = req.query;

    let query = `
      SELECT id_wifi, id_aula, usuarios_conectados, ancho_banda, latencia, jitter,
             perdida_paquetes, nivel_senal, fecha
      FROM metricaswifi
      WHERE 1=1
    `;
    const params = [];

    if (fechaInicio) {
      params.push(fechaInicio);
      query += ` AND fecha >= $${params.length}`;
    }
    if (fechaFin) {
      params.push(fechaFin);
      query += ` AND fecha <= $${params.length}`;
    }
    if (idAula) {
      params.push(idAula);
      query += ` AND id_aula = $${params.length}`;
    }

    query += ` ORDER BY fecha ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Error en /metricaswifi:", err);
    res.status(500).json({ error: err.message });
  }
});



// ---------------- INICIO SERVIDOR ----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

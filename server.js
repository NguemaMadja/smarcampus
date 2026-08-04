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

// ---------------- FUNCIÓN AUXILIAR PARA REGISTRO ----------------
async function registrarAccion({ id_usuario, accion, modulo, detalle, dispositivo, ip, resultado, duracion_segundos }) {
  try {
    await pool.query(
      `INSERT INTO logsactividad 
       (id_usuario, accion, modulo, detalle, dispositivo, ip, resultado, duracion_segundos, fecha) 
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
      [id_usuario, accion, modulo, detalle, dispositivo, ip, resultado, duracion_segundos]
    );

    await pool.query(
      `INSERT INTO huella_usuarios 
       (id_usuario, accion, modulo, detalle, dispositivo, ip, resultado, duracion_segundos, fecha_hora) 
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
      [id_usuario, accion, modulo, detalle, dispositivo, ip, resultado, duracion_segundos]
    );
  } catch (err) {
    console.error("Error registrando acción:", err);
  }
}

// ---------------- LOGIN ----------------
app.post('/login', async (req, res) => {
  const { correo, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM usuarios WHERE correo=$1", [correo]);
    if (result.rows.length === 0) return res.status(401).json({ error: "Usuario no encontrado" });

    const usuario = result.rows[0];
    const valido = bcrypt.compareSync(password, usuario.password_hash);
    if (!valido) return res.status(401).json({ error: "Contraseña incorrecta" });

    // 👇 Registrar acción en actividad y huella
    await registrarAccion({
      id_usuario: usuario.id_usuario,
      accion: 'LOGIN',
      modulo: 'Autenticación',
      detalle: `Usuario ${usuario.nombre} inició sesión`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    // 👇 Registrar acción
    await registrarAccion({
      id_usuario: id,
      accion: 'CONSULTAR',
      modulo: 'Usuarios',
      detalle: `Consulta de usuario ${id}`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    // 👇 Registrar acción
    await registrarAccion({
      id_usuario: result.rows[0].id_usuario,
      accion: 'CREAR',
      modulo: 'Usuarios',
      detalle: `Usuario ${nombre} creado`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    // 👇 Registrar acción
    await registrarAccion({
      id_usuario: id,
      accion: 'EDITAR',
      modulo: 'Usuarios',
      detalle: `Usuario ${nombre} actualizado`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    // 👇 Registrar acción
    await registrarAccion({
      id_usuario: id,
      accion: 'ELIMINAR',
      modulo: 'Usuarios',
      detalle: `Usuario ${id} eliminado`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

    res.json({ message: 'Usuario eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// ENDPOINTS CRUD PROFESORES
// =========================

// Listar todos los profesores
app.get('/profesores', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.id_profesor, p.id_usuario, u.nombre AS nombre_usuario
      FROM profesores p
      LEFT JOIN usuarios u ON p.id_usuario = u.id_usuario
      ORDER BY p.id_profesor ASC
    `);

    await registrarAccion({
      id_usuario: null,
      accion: 'CONSULTAR',
      modulo: 'Profesores',
      detalle: 'Listado de profesores consultado',
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo profesores" });
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
    const id_profesor = result.rows[0].id_profesor;

    if (departamentos_ids?.length) {
      for (const depId of departamentos_ids) {
        await pool.query('INSERT INTO profesor_departamento (id_profesor, id_departamento) VALUES ($1, $2)', [id_profesor, depId]);
      }
    }
    if (carreras_ids?.length) {
      for (const carId of carreras_ids) {
        await pool.query('INSERT INTO profesor_carrera (id_profesor, id_carrera) VALUES ($1, $2)', [id_profesor, carId]);
      }
    }
    if (asignaturas_ids?.length) {
      for (const asigId of asignaturas_ids) {
        await pool.query('INSERT INTO profesor_asignatura (id_profesor, id_asignatura) VALUES ($1, $2)', [id_profesor, asigId]);
      }
    }

    await registrarAccion({
      id_usuario,
      accion: 'CREAR',
      modulo: 'Profesores',
      detalle: `Profesor ${id_profesor} creado`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

    res.json({ mensaje: 'Profesor creado correctamente', id_profesor });
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

    await registrarAccion({
      id_usuario,
      accion: 'EDITAR',
      modulo: 'Profesores',
      detalle: `Profesor ${id} actualizado`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    await registrarAccion({
      id_usuario: null,
      accion: 'ELIMINAR',
      modulo: 'Profesores',
      detalle: `Profesor ${id} eliminado`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    // 👇 Registrar acción
    await registrarAccion({
      id_usuario: null,
      accion: 'CONSULTAR',
      modulo: 'Estudiantes',
      detalle: 'Consulta de todos los estudiantes',
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    // 👇 Registrar acción
    await registrarAccion({
      id_usuario: result.rows[0].id_usuario,
      accion: 'CONSULTAR',
      modulo: 'Estudiantes',
      detalle: `Consulta de estudiante ${id}`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    // 👇 Registrar acción
    await registrarAccion({
      id_usuario,
      accion: 'CREAR',
      modulo: 'Estudiantes',
      detalle: `Estudiante ${matricula} creado`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    // 👇 Registrar acción
    await registrarAccion({
      id_usuario,
      accion: 'EDITAR',
      modulo: 'Estudiantes',
      detalle: `Estudiante ${id} actualizado`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    // 👇 Registrar acción
    await registrarAccion({
      id_usuario: result.rows[0].id_usuario,
      accion: 'ELIMINAR',
      modulo: 'Estudiantes',
      detalle: `Estudiante ${id} eliminado`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

    res.json({ mensaje: 'Estudiante eliminado correctamente', data: result.rows[0] });
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

    await registrarAccion({
      id_usuario: null,
      accion: 'CONSULTAR',
      modulo: 'Mapa',
      detalle: 'Consulta de estadísticas de navegación en el mapa',
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    await registrarAccion({
      id_usuario: null,
      accion: 'CONSULTAR',
      modulo: 'Radio UNGE',
      detalle: 'Consulta de oyentes de Radio UNGE',
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📻 CRUD de Programas de Radio UNGE
app.get('/radiounge', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM radiounge ORDER BY id ASC");

    await registrarAccion({
      id_usuario: null,
      accion: 'CONSULTAR',
      modulo: 'Radio UNGE',
      detalle: 'Consulta de todos los programas de Radio UNGE',
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener un programa por ID
app.get('/radiounge/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM radiounge WHERE id=$1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Programa no encontrado" });
    }

    await registrarAccion({
      id_usuario: null,
      accion: 'CONSULTAR',
      modulo: 'Radio UNGE',
      detalle: `Consulta de programa ${id}`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear programa
app.post('/radiounge', async (req, res) => {
  try {
    const { titulo_programa, tipo_id, fecha_hora_inicio, fecha_hora_fin, es_en_vivo, locutorio_id } = req.body;

    await pool.query(
      "INSERT INTO radiounge (titulo_programa, tipo_id, fecha_hora_inicio, fecha_hora_fin, es_en_vivo, locutorio_id) VALUES ($1,$2,$3,$4,$5,$6)",
      [titulo_programa, tipo_id, fecha_hora_inicio, fecha_hora_fin, es_en_vivo, locutorio_id]
    );

    await registrarAccion({
      id_usuario: null,
      accion: 'CREAR',
      modulo: 'Radio UNGE',
      detalle: `Programa ${titulo_programa} creado`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

    res.sendStatus(201);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// ENDPOINTS CRUD DEPARTAMENTOS
// =========================

// Listar departamentos
app.get('/departamentos', async (req, res) => {
  try {
    const result = await pool.query('SELECT id_departamento, nombre FROM departamentos ORDER BY id_departamento ASC');

    await registrarAccion({
      id_usuario: null,
      accion: 'CONSULTAR',
      modulo: 'Departamentos',
      detalle: 'Listado de departamentos consultado',
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo departamentos" });
  }
});

// Crear departamento
app.post('/departamentos', async (req, res) => {
  try {
    const { nombre } = req.body;
    const result = await pool.query(
      'INSERT INTO departamentos (nombre) VALUES ($1) RETURNING *',
      [nombre]
    );

    await registrarAccion({
      id_usuario: null,
      accion: 'CREAR',
      modulo: 'Departamentos',
      detalle: `Departamento ${result.rows[0].id_departamento} creado`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Actualizar departamento
app.put('/departamentos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    const result = await pool.query(
      'UPDATE departamentos SET nombre=$1 WHERE id_departamento=$2 RETURNING *',
      [nombre, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Departamento no encontrado' });

    await registrarAccion({
      id_usuario: null,
      accion: 'EDITAR',
      modulo: 'Departamentos',
      detalle: `Departamento ${id} actualizado`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Eliminar departamento
app.delete('/departamentos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM departamentos WHERE id_departamento=$1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Departamento no encontrado' });

    await registrarAccion({
      id_usuario: null,
      accion: 'ELIMINAR',
      modulo: 'Departamentos',
      detalle: `Departamento ${id} eliminado`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

    res.json({ mensaje: 'Departamento eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ---------------- CARRERAS CRUD ----------------
app.get('/carreras', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM carreras ORDER BY id_carrera');

    await registrarAccion({
      id_usuario: null,
      accion: 'CONSULTAR',
      modulo: 'Carreras',
      detalle: 'Consulta de todas las carreras',
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    await registrarAccion({
      id_usuario: null,
      accion: 'CONSULTAR',
      modulo: 'Carreras',
      detalle: `Consulta de carrera ${id}`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    await registrarAccion({
      id_usuario: null,
      accion: 'CREAR',
      modulo: 'Carreras',
      detalle: `Carrera ${nombre} creada`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    await registrarAccion({
      id_usuario: null,
      accion: 'EDITAR',
      modulo: 'Carreras',
      detalle: `Carrera ${id} actualizada`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    await registrarAccion({
      id_usuario: null,
      accion: 'ELIMINAR',
      modulo: 'Carreras',
      detalle: `Carrera ${id} eliminada`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    await registrarAccion({
      id_usuario: null,
      accion: 'CONSULTAR',
      modulo: 'Edificios',
      detalle: 'Consulta de todos los edificios',
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    await registrarAccion({
      id_usuario: null,
      accion: 'CONSULTAR',
      modulo: 'Edificios',
      detalle: `Consulta de edificio ${id}`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    await registrarAccion({
      id_usuario: null,
      accion: 'CREAR',
      modulo: 'Edificios',
      detalle: `Edificio ${nombre} creado`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    await registrarAccion({
      id_usuario: null,
      accion: 'EDITAR',
      modulo: 'Edificios',
      detalle: `Edificio ${id} actualizado`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    await registrarAccion({
      id_usuario: null,
      accion: 'ELIMINAR',
      modulo: 'Edificios',
      detalle: `Edificio ${id} eliminado`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    await registrarAccion({
      id_usuario: null,
      accion: 'CONSULTAR',
      modulo: 'Mapa',
      detalle: `Búsqueda de edificio ${nombre}`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    await registrarAccion({
      id_usuario: usuario_id,
      accion: 'CREAR',
      modulo: 'Mapa',
      detalle: `Huella registrada en edificio ${edificio_id}`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    await registrarAccion({
      id_usuario: usuario_id,
      accion: 'EDITAR',
      modulo: 'Mapa',
      detalle: `Usuario ${usuario_id} llegó al edificio ${edificio_id}`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

    res.json({ mensaje: "Bienvenido al edificio!", data: result.rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =========================
// ENDPOINTS CRUD ASIGNATURAS
// =========================

// Listar asignaturas
app.get('/asignaturas', async (req, res) => {
  try {
    const result = await pool.query('SELECT id_asignatura, nombre FROM asignaturas ORDER BY id_asignatura ASC');

    await registrarAccion({
      id_usuario: null,
      accion: 'CONSULTAR',
      modulo: 'Asignaturas',
      detalle: 'Listado de asignaturas consultado',
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo asignaturas" });
  }
});

// Crear asignatura
app.post('/asignaturas', async (req, res) => {
  try {
    const { nombre } = req.body;
    const result = await pool.query(
      'INSERT INTO asignaturas (nombre) VALUES ($1) RETURNING *',
      [nombre]
    );

    await registrarAccion({
      id_usuario: null,
      accion: 'CREAR',
      modulo: 'Asignaturas',
      detalle: `Asignatura ${result.rows[0].id_asignatura} creada`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Actualizar asignatura
app.put('/asignaturas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    const result = await pool.query(
      'UPDATE asignaturas SET nombre=$1 WHERE id_asignatura=$2 RETURNING *',
      [nombre, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Asignatura no encontrada' });

    await registrarAccion({
      id_usuario: null,
      accion: 'EDITAR',
      modulo: 'Asignaturas',
      detalle: `Asignatura ${id} actualizada`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Eliminar asignatura
app.delete('/asignaturas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM asignaturas WHERE id_asignatura=$1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Asignatura no encontrada' });

    await registrarAccion({
      id_usuario: null,
      accion: 'ELIMINAR',
      modulo: 'Asignaturas',
      detalle: `Asignatura ${id} eliminada`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

    res.json({ mensaje: 'Asignatura eliminada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ---------------- TIPOS DE SENSORES CRUD ----------------
app.get('/tipos_sensores', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tipos_sensores ORDER BY id_tipo');

    await registrarAccion({
      id_usuario: null,
      accion: 'CONSULTAR',
      modulo: 'Tipos de Sensores',
      detalle: 'Consulta de todos los tipos de sensores',
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    await registrarAccion({
      id_usuario: null,
      accion: 'CREAR',
      modulo: 'Tipos de Sensores',
      detalle: `Tipo de sensor ${nombre} creado`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    await registrarAccion({
      id_usuario: null,
      accion: 'ELIMINAR',
      modulo: 'Tipos de Sensores',
      detalle: `Tipo de sensor ${id} eliminado`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    await registrarAccion({
      id_usuario: null,
      accion: 'CONSULTAR',
      modulo: 'Aulas',
      detalle: 'Consulta de todas las aulas',
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    await registrarAccion({
      id_usuario: null,
      accion: 'CREAR',
      modulo: 'Aulas',
      detalle: `Aula ${nombre} creada`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    await registrarAccion({
      id_usuario: null,
      accion: 'EDITAR',
      modulo: 'Aulas',
      detalle: `Aula ${id} actualizada`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    await registrarAccion({
      id_usuario: null,
      accion: 'ELIMINAR',
      modulo: 'Aulas',
      detalle: `Aula ${id} eliminada`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    await registrarAccion({
      id_usuario: null,
      accion: 'CONSULTAR',
      modulo: 'Sensores',
      detalle: 'Consulta de todos los sensores',
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    await registrarAccion({
      id_usuario: null,
      accion: 'CREAR',
      modulo: 'Sensores',
      detalle: `Sensor creado en aula ${id_aula}`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    await registrarAccion({
      id_usuario: null,
      accion: 'EDITAR',
      modulo: 'Sensores',
      detalle: `Sensor ${id} actualizado`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    await registrarAccion({
      id_usuario: null,
      accion: 'ELIMINAR',
      modulo: 'Sensores',
      detalle: `Sensor ${id} eliminado`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    await registrarAccion({
      id_usuario: null,
      accion: 'CREAR',
      modulo: 'Sensores',
      detalle: `Lectura registrada para sensor ${id_sensor}`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

    await registrarAccion({
      id_usuario: null,
      accion: 'CONSULTAR',
      modulo: 'Sensores',
      detalle: `Consulta historial del sensor ${id}`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

  await registrarAccion({
    id_usuario: null,
    accion: 'CREAR',
    modulo: 'Aulas',
    detalle: `QR generado para aula ${id}`,
    dispositivo: 'Web',
    ip: req.ip,
    resultado: 'OK',
    duracion_segundos: 0
  });

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

  await registrarAccion({
    id_usuario: null,
    accion: 'CONSULTAR',
    modulo: 'Aulas',
    detalle: `Consulta QR vigente del aula ${id}`,
    dispositivo: 'Web',
    ip: req.ip,
    resultado: 'OK',
    duracion_segundos: 0
  });

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

    await registrarAccion({
      id_usuario: null,
      accion: 'CREAR',
      modulo: 'Asistencia Profesores',
      detalle: `Asistencia registrada para profesor ${id_profesor} en aula ${id_aula}`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

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

// ---------------- MÉTRICAS WIFI ----------------

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

    await registrarAccion({
      id_usuario: null,
      accion: 'CONSULTAR',
      modulo: 'WiFi',
      detalle: 'Consulta de métricas WiFi',
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

    res.json(result.rows);
  } catch (err) {
    console.error("Error en /metricaswifi:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== MÓDULO HUELLA ====================

// Endpoint: métricas para el dashboard Huella
app.get('/api/huella/metricas', async (req, res) => {
  try {
    const totalAcciones = await pool.query('SELECT COUNT(*) FROM huella_usuarios');
    const usuariosActivos = await pool.query('SELECT COUNT(DISTINCT id_usuario) FROM huella_usuarios');

    // Usuarios conectados en los últimos 5 minutos
    const usuariosConectados = await pool.query(`
      SELECT COUNT(DISTINCT id_usuario) 
      FROM huella_usuarios 
      WHERE fecha_hora > NOW() - INTERVAL '5 minutes'
    `);

    // Módulo más usado
    const moduloTop = await pool.query(`
      SELECT modulo, COUNT(*) AS total 
      FROM huella_usuarios 
      GROUP BY modulo 
      ORDER BY total DESC LIMIT 1
    `);

    // Tiempo acumulado en Radio
    const tiempoRadio = await pool.query(`
      SELECT COALESCE(SUM(duracion_segundos),0) AS total 
      FROM huella_usuarios WHERE modulo ILIKE 'Radio%'
    `);

    // Acciones por módulo
    const accionesPorModulo = await pool.query(`
      SELECT modulo, COUNT(*) AS total 
      FROM huella_usuarios 
      GROUP BY modulo
    `);

    // Top 5 usuarios más activos
    const usuariosMasActivos = await pool.query(`
      SELECT id_usuario, COUNT(*) AS total 
      FROM huella_usuarios 
      GROUP BY id_usuario 
      ORDER BY total DESC LIMIT 5
    `);

    await registrarAccion({
      id_usuario: null,
      accion: 'CONSULTAR',
      modulo: 'Huella',
      detalle: 'Consulta de métricas de huella',
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

    res.json({
      totalAcciones: parseInt(totalAcciones.rows[0].count),
      usuariosActivos: parseInt(usuariosActivos.rows[0].count),
      usuariosConectados: parseInt(usuariosConectados.rows[0].count),
      moduloTop: moduloTop.rows[0]?.modulo || '-',
      tiempoRadio: parseInt(tiempoRadio.rows[0].total),
      accionesPorModulo: Object.fromEntries(accionesPorModulo.rows.map(r => [r.modulo, parseInt(r.total)])),
      usuariosMasActivos: Object.fromEntries(usuariosMasActivos.rows.map(r => [`Usuario ${r.id_usuario}`, parseInt(r.total)]))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener métricas de huella' });
  }
});

// Endpoint: registrar una nueva huella
app.post('/api/huella', async (req, res) => {
  try {
    const { id_usuario, accion, modulo, detalle, dispositivo, ip, resultado, duracion_segundos } = req.body;
    const query = `
      INSERT INTO huella_usuarios 
      (id_usuario, accion, modulo, detalle, dispositivo, ip, resultado, duracion_segundos, fecha_hora)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
      RETURNING *;
    `;
    const values = [id_usuario, accion, modulo, detalle, dispositivo, ip, resultado, duracion_segundos];
    const result = await pool.query(query, values);

    await registrarAccion({
      id_usuario,
      accion,
      modulo,
      detalle,
      dispositivo,
      ip,
      resultado,
      duracion_segundos
    });

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar huella' });
  }
});

// Endpoint: historial de un usuario
app.get('/api/huella/:id_usuario', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM huella_usuarios WHERE id_usuario=$1 ORDER BY fecha_hora DESC',
      [req.params.id_usuario]
    );

    await registrarAccion({
      id_usuario: req.params.id_usuario,
      accion: 'CONSULTAR',
      modulo: 'Huella',
      detalle: `Consulta historial de huella del usuario ${req.params.id_usuario}`,
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener historial de huella' });
  }
});

// =======================
// ENDPOINTS ACTIVIDAD
// =======================

// Obtener registros de actividad con filtros
app.get('/api/logsactividad', async (req, res) => {
  const { usuario, modulo, inicio, fin } = req.query;

  let query = `SELECT * FROM logsactividad WHERE 1=1`;
  let params = [];

  if (usuario) {
    params.push(usuario);
    query += ` AND id_usuario = $${params.length}`;
  }
  if (modulo) {
    params.push(modulo);
    query += ` AND modulo ILIKE $${params.length}`;
  }
  if (inicio) {
    params.push(inicio);
    query += ` AND fecha >= $${params.length}`;
  }
  if (fin) {
    params.push(fin);
    query += ` AND fecha <= $${params.length}`;
  }

  query += ` ORDER BY fecha DESC`;

  try {
    const result = await pool.query(query, params);

    await registrarAccion({
      id_usuario: usuario || null,
      accion: 'CONSULTAR',
      modulo: 'Actividad',
      detalle: 'Consulta de registros de actividad',
      dispositivo: 'Web',
      ip: req.ip,
      resultado: 'OK',
      duracion_segundos: 0
    });

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener actividad' });
  }
});

// Insertar nueva actividad
app.post('/api/logsactividad', async (req, res) => {
  const { id_usuario, accion, modulo, detalle, dispositivo, ip, resultado, duracion_segundos } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO logsactividad 
       (id_usuario, accion, modulo, detalle, dispositivo, ip, resultado, duracion_segundos, fecha) 
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) RETURNING *`,
      [id_usuario, accion, modulo, detalle, dispositivo, ip, resultado, duracion_segundos]
    );

    await registrarAccion({
      id_usuario,
      accion,
      modulo,
      detalle,
      dispositivo,
      ip,
      resultado,
      duracion_segundos
    });

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar actividad' });
  }
});



// =========================
// ENDPOINTS DE ASISTENCIA
// =========================

// 1. Generar QR para un aula
app.post('/qr/generar', async (req, res) => {
  try {
    const { id_aula, id_asignatura, semana } = req.body;
    const codigo = require('uuid').v4();
    const validoHasta = new Date();
    validoHasta.setDate(validoHasta.getDate() + 7); // válido por 1 semana

    const result = await pool.query(`
      INSERT INTO qr_aulas (id_aula, id_asignatura, semana, codigo_qr, valido_hasta)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [id_aula, id_asignatura, semana, codigo, validoHasta]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error generando QR" });
  }
});

// 2. Validar QR escaneado
app.post('/qr/validar', async (req, res) => {
  try {
    const { codigo_qr } = req.body;
    const result = await pool.query(`
      SELECT * FROM qr_aulas
      WHERE codigo_qr = $1 AND valido_hasta >= CURRENT_TIMESTAMP
    `, [codigo_qr]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "QR inválido o caducado" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error validando QR" });
  }
});

// 3. Registrar asistencia
app.post('/asistencia', async (req, res) => {
  try {
    const { id_profesor, id_departamento, id_carrera, id_asignatura, id_aula, codigo_qr } = req.body;

    // Validar QR primero
    const qr = await pool.query(`
      SELECT id_qr FROM qr_aulas
      WHERE codigo_qr = $1 AND valido_hasta >= CURRENT_TIMESTAMP
    `, [codigo_qr]);

    if (qr.rows.length === 0) {
      return res.status(400).json({ error: "QR inválido o caducado" });
    }

    const id_qr = qr.rows[0].id_qr;

    const result = await pool.query(`
      INSERT INTO asistencia (
        id_profesor, id_departamento, id_carrera, id_asignatura, id_aula,
        fecha, hora_entrada, validacion, codigo_qr, id_qr
      ) VALUES (
        $1, $2, $3, $4, $5,
        CURRENT_DATE, CURRENT_TIMESTAMP, TRUE, $6, $7
      ) RETURNING *
    `, [id_profesor, id_departamento, id_carrera, id_asignatura, id_aula, codigo_qr, id_qr]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error registrando asistencia" });
  }
});

// 4. Listar asistencias
app.get('/asistencia', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM asistencia ORDER BY fecha DESC`);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo asistencias" });
  }
});



// ---------------- INICIO SERVIDOR ----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

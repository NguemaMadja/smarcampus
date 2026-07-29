-- =========================================
-- TABLAS BASE
-- =========================================

DROP TABLE IF EXISTS Usuarios CASCADE;
CREATE TABLE Usuarios (
    id_usuario SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    correo VARCHAR(100) UNIQUE NOT NULL,
    facultad VARCHAR(100)
);

DROP TABLE IF EXISTS Registro CASCADE;
CREATE TABLE Registro (
    id_registro SERIAL PRIMARY KEY,
    id_usuario INT REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(200) NOT NULL,
    rol VARCHAR(20) CHECK (rol IN ('admin','profesor','estudiante'))
);

DROP TABLE IF EXISTS Profesores CASCADE;
CREATE TABLE Profesores (
    id_profesor SERIAL PRIMARY KEY,
    id_usuario INT REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,

);

DROP TABLE IF EXISTS Estudiantes CASCADE;
CREATE TABLE Estudiantes (
    id_estudiante SERIAL PRIMARY KEY,
    id_usuario INT REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
    matricula VARCHAR(50) UNIQUE
);

DROP TABLE IF EXISTS Asignaturas CASCADE;
CREATE TABLE Asignaturas (
    id_asignatura SERIAL PRIMARY KEY,
    nombre VARCHAR(100),
);


-- =========================================
-- NUEVAS TABLAS PARA RELACIONES DE PROFESORES
-- =========================================

-- Tabla de Departamentos
DROP TABLE IF EXISTS Departamentos CASCADE;
CREATE TABLE Departamentos (
    id_departamento SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL
);

-- Tabla de Carreras
DROP TABLE IF EXISTS Carreras CASCADE;
CREATE TABLE Carreras (
    id_carrera SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL
);

-- Tabla intermedia profesor_departamento
DROP TABLE IF EXISTS Profesor_Departamento CASCADE;
CREATE TABLE Profesor_Departamento (
    id_profesor INT REFERENCES Profesores(id_profesor) ON DELETE CASCADE,
    id_departamento INT REFERENCES Departamentos(id_departamento) ON DELETE CASCADE,
    PRIMARY KEY (id_profesor, id_departamento)
);

-- Tabla intermedia profesor_carrera
DROP TABLE IF EXISTS Profesor_Carrera CASCADE;
CREATE TABLE Profesor_Carrera (
    id_profesor INT REFERENCES Profesores(id_profesor) ON DELETE CASCADE,
    id_carrera INT REFERENCES Carreras(id_carrera) ON DELETE CASCADE,
    PRIMARY KEY (id_profesor, id_carrera)
);

-- Tabla intermedia profesor_asignatura
DROP TABLE IF EXISTS Profesor_Asignatura CASCADE;
CREATE TABLE Profesor_Asignatura (
    id_profesor INT REFERENCES Profesores(id_profesor) ON DELETE CASCADE,
    id_asignatura INT REFERENCES Asignaturas(id_asignatura) ON DELETE CASCADE,
    PRIMARY KEY (id_profesor, id_asignatura)
);



DROP TABLE IF EXISTS Edificios CASCADE;
CREATE TABLE Edificios (
    id_edificio SERIAL PRIMARY KEY,
    nombre VARCHAR(100),
    ubicacion VARCHAR(200)
);

DROP TABLE IF EXISTS Aulas CASCADE;
CREATE TABLE Aulas (
    id_aula SERIAL PRIMARY KEY,
    nombre VARCHAR(50),
    capacidad INT,
    id_edificio INT REFERENCES Edificios(id_edificio)
);

DROP TABLE IF EXISTS Sensores CASCADE;
CREATE TABLE Sensores (
    id_sensor SERIAL PRIMARY KEY,
    tipo VARCHAR(50),
    id_aula INT REFERENCES Aulas(id_aula)
);

DROP TABLE IF EXISTS MedicionesAmbientales CASCADE;
CREATE TABLE MedicionesAmbientales (
    id_medicion SERIAL PRIMARY KEY,
    id_sensor INT REFERENCES Sensores(id_sensor),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valor NUMERIC
);

DROP TABLE IF EXISTS MetricasWiFi CASCADE;
CREATE TABLE MetricasWiFi (
    id_wifi SERIAL PRIMARY KEY,
    id_aula INT REFERENCES Aulas(id_aula),
    usuarios_conectados INT,
    ancho_banda NUMERIC,
    latencia NUMERIC,
    jitter NUMERIC,
    perdida_paquetes NUMERIC,
    nivel_senal NUMERIC,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS Asistencia CASCADE;
CREATE TABLE Asistencia (
    id_asistencia SERIAL PRIMARY KEY,
    id_estudiante INT REFERENCES Estudiantes(id_estudiante),
    id_asignatura INT REFERENCES Asignaturas(id_asignatura),
    fecha DATE
);

DROP TABLE IF EXISTS TransporteEscolar CASCADE;
CREATE TABLE TransporteEscolar (
    id_transporte SERIAL PRIMARY KEY,
    ruta VARCHAR(100),
    capacidad INT
);

DROP TABLE IF EXISTS Materiales CASCADE;
CREATE TABLE Materiales (
    id_material SERIAL PRIMARY KEY,
    nombre VARCHAR(100),
    tipo VARCHAR(50),
    id_asignatura INT REFERENCES Asignaturas(id_asignatura)
);

DROP TABLE IF EXISTS VisitasApp CASCADE;
CREATE TABLE VisitasApp (
    id_visita SERIAL PRIMARY KEY,
    id_usuario INT REFERENCES Usuarios(id_usuario),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS Alertas CASCADE;
CREATE TABLE Alertas (
    id_alerta SERIAL PRIMARY KEY,
    mensaje VARCHAR(200),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS LogsActividad CASCADE;
CREATE TABLE LogsActividad (
    id_log SERIAL PRIMARY KEY,
    id_usuario INT REFERENCES Usuarios(id_usuario),
    accion VARCHAR(200),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS Mapa CASCADE;
CREATE TABLE Mapa (
    id_mapa SERIAL PRIMARY KEY,
    id_edificio INT REFERENCES Edificios(id_edificio) ON DELETE CASCADE,
    coordenadas VARCHAR(200) NOT NULL,
    foto BYTEA,
    ruta_foto VARCHAR(300)
);
-- =========================================
-- RADIO UNGE Y MÉTRICAS
-- =========================================

-- Tabla de programas de radio
DROP TABLE IF EXISTS RadioUNGE CASCADE;
CREATE TABLE RadioUNGE (
    id SERIAL PRIMARY KEY,
    titulo_programa VARCHAR(150) NOT NULL,          -- nombre del programa
    tipo_id VARCHAR(50) NOT NULL,                   -- educativo, cultural, informativo, etc.
    fecha_hora_inicio TIMESTAMP NOT NULL,           -- inicio exacto
    fecha_hora_fin TIMESTAMP NOT NULL,              -- fin exacto
    es_en_vivo BOOLEAN DEFAULT TRUE,                -- directo vs grabado
    locutor_id INT REFERENCES Profesores(id_profesor) -- profesor que conduce
);

-- Índices para optimizar consultas
CREATE INDEX idx_radio_tipo ON RadioUNGE(tipo_id);
CREATE INDEX idx_radio_inicio ON RadioUNGE(fecha_hora_inicio);
CREATE INDEX idx_radio_locutor ON RadioUNGE(locutor_id);

-- Tabla de métricas de escucha
DROP TABLE IF EXISTS Estadisticas_Escucha CASCADE;
CREATE TABLE Estadisticas_Escucha (
    id SERIAL PRIMARY KEY,
    id_programa INT REFERENCES RadioUNGE(id),       -- programa escuchado
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,      -- momento de reproducción
    usuario_id INT REFERENCES Estudiantes(id_estudiante), -- estudiante que escuchó (opcional)
    segundos_escuchados INT NOT NULL                -- tiempo escuchado en segundos
);

-- Índices para optimizar métricas
CREATE INDEX idx_escucha_programa ON Estadisticas_Escucha(id_programa);
CREATE INDEX idx_escucha_fecha ON Estadisticas_Escucha(fecha);
-- =========================================
-- INSERCIONES DE PRUEBA DE USUARIOS Y PROFESORES
-- =========================================

-- Usuarios y credenciales
INSERT INTO Usuarios (nombre, correo, facultad)
VALUES ('Juan Pérez', 'juan@unge.edu', 'Ingeniería');
INSERT INTO Registro (id_usuario, username, password, rol)
VALUES (1, 'juan', crypt('claveProfesor', gen_salt('bf')), 'profesor');

INSERT INTO Usuarios (nombre, correo, facultad)
VALUES ('María Gómez', 'maria@unge.edu', 'Ciencias Sociales');
INSERT INTO Registro (id_usuario, username, password, rol)
VALUES (2, 'maria', crypt('claveEstudiante', gen_salt('bf')), 'estudiante');

INSERT INTO Usuarios (nombre, correo, facultad)
VALUES ('Carlos López', 'carlos@unge.edu', 'Administración General');
INSERT INTO Registro (id_usuario, username, password, rol)
VALUES (3, 'carlos', crypt('claveAdmin', gen_salt('bf')), 'admin');

INSERT INTO Profesor_Departamento (id_profesor, id_departamento)
VALUES
(1, 3), -- Profesor 1 en Educación
(2, 2), -- Profesor 2 en Ciencias Sociales
(3, 1); -- Profesor 3 en Ingeniería

-- =========================================
-- INSERCIONES DE EDIFICIOS Y MAPAS (16)
-- =========================================

INSERT INTO Edificios (nombre, ubicacion) VALUES ('ENTRADA-PRINCIPAL','Campus UNGE');
INSERT INTO Mapa (id_edificio, coordenadas, ruta_foto)
VALUES (currval('edificios_id_edificio_seq'),'3.7166214N, 8.6740411E','/home/piangel/SmartCampusGuide/fotos/fotos-campus-para-localizar-edif/entrada_principal.jpeg');

INSERT INTO Edificios (nombre, ubicacion) VALUES ('RESIDENCIA-ESTUDIANTIL','Campus UNGE');
INSERT INTO Mapa (id_edificio, coordenadas, ruta_foto)
VALUES (currval('edificios_id_edificio_seq'),'3.720000N, 8.672722E','/home/piangel/SmartCampusGuide/fotos/fotos-campus-para-localizar-edif/Residencia_estudiantil.jpeg');

INSERT INTO Edificios (nombre, ubicacion) VALUES ('BIBLIOTECAS','Campus UNGE');
INSERT INTO Mapa (id_edificio, coordenadas, ruta_foto)
VALUES (currval('edificios_id_edificio_seq'),'3.718444N, 8.673417E','/home/piangel/SmartCampusGuide/fotos/fotos-campus-para-localizar-edif/bibliotecas.jpeg');

INSERT INTO Edificios (nombre, ubicacion) VALUES ('FACULTAD-DERECHO-Y-CIENCIAS-POLITICAS','Campus UNGE');
INSERT INTO Mapa (id_edificio, coordenadas, ruta_foto)
VALUES (currval('edificios_id_edificio_seq'),'3.7173889N, 8.6719722E','/home/piangel/SmartCampusGuide/fotos/fotos-campus-para-localizar-edif/Derecho_ciencias_politicas.jpeg');

INSERT INTO Edificios (nombre, ubicacion) VALUES ('ENTRADA-LUBA','Campus UNGE');
INSERT INTO Mapa (id_edificio, coordenadas, ruta_foto)
VALUES (currval('edificios_id_edificio_seq'),'3.71575N, 8.66708E','/home/piangel/SmartCampusGuide/fotos/fotos-campus-para-localizar-edif/entrada_Luba.jpeg');

INSERT INTO Edificios (nombre, ubicacion) VALUES ('FACULTAD-CIENCIAS-INFORMACION-FILOLOGIA','Campus UNGE');
INSERT INTO Mapa (id_edificio, coordenadas, ruta_foto)
VALUES (currval('edificios_id_edificio_seq'),'3.71797N, 8.67433E','/home/piangel/SmartCampusGuide/fotos/fotos-campus-para-localizar-edif/facultad_ciencias_informacion_filologia.jpeg');

INSERT INTO Edificios (nombre, ubicacion) VALUES ('FACULTAD-PEDAGOGIA-CIENCIAS-EDUCACION','Campus UNGE');
INSERT INTO Mapa (id_edificio, coordenadas, ruta_foto)
VALUES (currval('edificios_id_edificio_seq'),'3.717417N, 8.672861E','/home/piangel/SmartCampusGuide/fotos/fotos-campus-para-localizar-edif/facultad_pedagogia_ciencias_educacion.jpeg');

INSERT INTO Edificios (nombre, ubicacion) VALUES ('FACULTAD-INGENIERIA-MEDIO-AMBIENTE','Campus UNGE');
INSERT INTO Mapa (id_edificio, coordenadas, ruta_foto)
VALUES (currval('edificios_id_edificio_seq'),'3.717778N, 8.675111E','/home/piangel/SmartCampusGuide/fotos/fotos-campus-para-localizar-edif/facultad_ingenieria_medio_ambiente.jpeg');

INSERT INTO Edificios (nombre, ubicacion) VALUES ('FACULTAD-C-ECONOMICAS-GESTION-ADMINISTRACION','Campus UNGE');
INSERT INTO Mapa (id_edificio, coordenadas, ruta_foto)
VALUES (currval('edificios_id_edificio_seq'),'3.718277N, 8.674916E','/home/piangel/SmartCampusGuide/fotos/fotos-campus-para-localizar-edif/facultal-ciencia_economicas_gestion_administracion.jpeg');

INSERT INTO Edificios (nombre, ubicacion) VALUES ('F-HUMANIDADES-Y-CIENCIAS-RELIGIOSAS','Campus UNGE');
INSERT INTO Mapa (id_edificio, coordenadas, ruta_foto)
VALUES (currval('edificios_id_edificio_seq'),'3.716694N, 8.666806E','/home/piangel/SmartCampusGuide/fotos/fotos-campus-para-localizar-edif/humanidades_ciencias_religiosas.jpeg');

INSERT INTO Edificios (nombre, ubicacion) VALUES ('LABORATORIOS','Campus UNGE');
INSERT INTO Mapa (id_edificio, coordenadas, ruta_foto)
VALUES (currval('edificios_id_edificio_seq'),'3.717139N, 8.674861E','/home/piangel/SmartCampusGuide/fotos/fotos-campus-para-localizar-edif/Laboratorios.jpeg');

INSERT INTO Edificios (nombre, ubicacion) VALUES ('RECTORADO','Campus UNGE');
INSERT INTO Mapa (id_edificio, coordenadas, ruta_foto)
VALUES (currval('edificios_id_edificio_seq'),'3.7166667N, 8.6732222E','/home/piangel/SmartCampusGuide/fotos/fotos-campus-para-localizar-edif/Rectorado.jpeg');

INSERT INTO Edificios (nombre, ubicacion) VALUES ('RESIDENCIA-PROFESORES-EDIF14','Campus UNGE');
INSERT INTO Mapa (id_edificio, coordenadas, ruta_foto)
VALUES (currval('edificios_id_edificio_seq'),'3.719167N, 8.671750E','/home/piangel/SmartCampusGuide/fotos/fotos-campus-para-localizar-edif/residencia_profesores-edif14.jpeg');

INSERT INTO Edificios (nombre, ubicacion) VALUES ('RESIDENCIA-PROFESORES-EDIF15','Campus UNGE');
INSERT INTO Mapa (id_edificio, coordenadas, ruta_foto)
VALUES (currval('edificios_id_edificio_seq'),'3.719722N, 8.660417E','/home/piangel/SmartCampusGuide/fotos/fotos-campus-para-localizar-edif/residencia_profesores_edif15.jpeg');

INSERT INTO Edificios (nombre, ubicacion) VALUES ('SALA-ACTIVIDADES-CULTURALES','Campus UNGE');
INSERT INTO Mapa (id_edificio, coordenadas, ruta_foto)
VALUES (currval('edificios_id_edificio_seq'),'3.718528N, 8.672194E','/home/piangel/SmartCampusGuide/fotos/fotos-campus-para-localizar-edif/sala_actividades_culturales.jpeg');

INSERT INTO Edificios (nombre, ubicacion) VALUES ('SALA-DE-RECOGIDA-DE-RESIDUOS-CAMPOS','Campus UNGE');
INSERT INTO Mapa (id_edificio, coordenadas, ruta_foto)

VALUES (currval('edificios_id_edificio_seq'),'3.721361N, 8.674389E','/home/piangel/SmartCampusGuide/fotos/fotos-campus-para-localizar-edif/sala_recogida_de_residuos_campos.jpeg');

-- =========================================
-- ACTUALIZACIÓN DE TABLA USUARIOS PARA AUTENTICACIÓN
-- =========================================

ALTER TABLE Usuarios
ADD COLUMN username VARCHAR(50) UNIQUE,
ADD COLUMN password_hash VARCHAR(255),
ADD COLUMN rol VARCHAR(20) DEFAULT 'estudiante';

-- =========================================
-- VISTAS DE REPORTES DE AUDIENCIA
-- =========================================

-- Reporte semanal
CREATE OR REPLACE VIEW reporte_audiencia_semanal AS
SELECT DATE_TRUNC('week', fecha) AS semana, id_programa,
       COUNT(*) AS total_reproducciones, SUM(segundos_escuchados) AS total_segundos
FROM Estadisticas_Escucha
GROUP BY semana, id_programa
ORDER BY semana DESC;

-- Reporte mensual
CREATE OR REPLACE VIEW reporte_audiencia_mensual AS
SELECT DATE_TRUNC('month', fecha) AS mes, id_programa,
       COUNT(*) AS total_reproducciones, SUM(segundos_escuchados) AS total_segundos
FROM Estadisticas_Escucha
GROUP BY mes, id_programa
ORDER BY mes DESC;

-- Reporte trimestral
CREATE OR REPLACE VIEW reporte_audiencia_trimestral AS
SELECT DATE_TRUNC('quarter', fecha) AS trimestre, id_programa,
       COUNT(*) AS total_reproducciones, SUM(segundos_escuchados) AS total_segundos
FROM Estadisticas_Escucha
GROUP BY trimestre, id_programa
ORDER BY trimestre DESC;

-- Reporte semestral
CREATE OR REPLACE VIEW reporte_audiencia_semestral AS
SELECT CASE
           WHEN DATE_PART('month', fecha) BETWEEN 1 AND 6 THEN CONCAT(DATE_PART('year', fecha), '-S1')
           ELSE CONCAT(DATE_PART('year', fecha), '-S2')
       END AS semestre,
       id_programa,
       COUNT(*) AS total_reproducciones,
       SUM(segundos_escuchados) AS total_segundos
FROM Estadisticas_Escucha
GROUP BY semestre, id_programa
ORDER BY semestre DESC;

CREATE TABLE Aula_QR (
    id_qr SERIAL PRIMARY KEY,
    id_aula INT REFERENCES Aulas(id_aula) ON DELETE CASCADE,
    codigo_qr VARCHAR(255) UNIQUE NOT NULL,
    fecha_inicio DATE,
    fecha_fin DATE
);


CREATE TABLE Asistencias_Profesores (
    id_asistencia SERIAL PRIMARY KEY,
    id_profesor INT REFERENCES Profesores(id_profesor),
    id_qr INT REFERENCES Aula_QR(id_qr),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(20) CHECK (estado IN ('presente','ausente'))
);



-- =========================================
-- ESTUDIANTES DE PRUEBA PARA MÉTRICAS (CORREGIDO)
-- =========================================

INSERT INTO Usuarios (nombre, correo, facultad)
VALUES ('Estudiante 10', 'est10@unge.edu', 'Ingeniería')
ON CONFLICT (correo) DO NOTHING;

INSERT INTO Estudiantes (id_usuario, matricula)
VALUES ((SELECT id_usuario FROM Usuarios WHERE correo='est10@unge.edu'), 'MAT-010')
ON CONFLICT (matricula) DO NOTHING;

INSERT INTO Usuarios (nombre, correo, facultad)
VALUES ('Estudiante 12', 'est12@unge.edu', 'Ciencias Sociales')
ON CONFLICT (correo) DO NOTHING;

INSERT INTO Estudiantes (id_usuario, matricula)
VALUES ((SELECT id_usuario FROM Usuarios WHERE correo='est12@unge.edu'), 'MAT-012')
ON CONFLICT (matricula) DO NOTHING;

INSERT INTO Usuarios (nombre, correo, facultad)
VALUES ('Estudiante 15', 'est15@unge.edu', 'Informática')
ON CONFLICT (correo) DO NOTHING;

INSERT INTO Estudiantes (id_usuario, matricula)
VALUES ((SELECT id_usuario FROM Usuarios WHERE correo='est15@unge.edu'), 'MAT-015')
ON CONFLICT (matricula) DO NOTHING;

-- =========================================
-- INSERCIONES DE PROGRAMAS DE RADIO
-- =========================================

INSERT INTO RadioUNGE (titulo_programa, tipo_id, fecha_hora_inicio, fecha_hora_fin, es_en_vivo, locutor_id)
VALUES
('Voz Estudiantil', 'educativo', '2026-07-10 10:00:00', '2026-07-10 11:00:00', TRUE, 1),
('Cultura Viva', 'cultural', '2026-07-11 18:00:00', '2026-07-11 19:30:00', FALSE, 2),
('Noticias Campus', 'informativo', '2026-07-12 08:00:00', '2026-07-12 08:30:00', TRUE, 3);

-- =========================================
-- INSERCIONES DE MÉTRICAS DE ESCUCHA (CORREGIDO)
-- =========================================

INSERT INTO Estadisticas_Escucha (id_programa, usuario_id, segundos_escuchados)
VALUES
(1, (SELECT id_estudiante FROM Estudiantes JOIN Usuarios USING (id_usuario) WHERE correo='est10@unge.edu'), 1800),
(1, NULL, 600),
(2, (SELECT id_estudiante FROM Estudiantes JOIN Usuarios USING (id_usuario) WHERE correo='est12@unge.edu'), 2700),
(3, (SELECT id_estudiante FROM Estudiantes JOIN Usuarios USING (id_usuario) WHERE correo='est15@unge.edu'), 900);
-- =========================================
-- USUARIOS DE PRUEBA CON CREDENCIALES Y ROLES
-- =========================================

-- Admin
INSERT INTO Usuarios (nombre, correo, facultad, username, password_hash, rol)
VALUES ('Admin Campus', 'admin@unge.edu', 'Administración', 'admin', '$2b$12$adminHashDePrueba', 'admin')
ON CONFLICT (correo) DO NOTHING;

-- Profesor
INSERT INTO Usuarios (nombre, correo, facultad, username, password_hash, rol)
VALUES ('Profesor Juan', 'profjuan@unge.edu', 'Ciencias Sociales', 'profjuan', '$2b$12$profHashDePrueba', 'profesor')
ON CONFLICT (correo) DO NOTHING;

-- Estudiante
INSERT INTO Usuarios (nombre, correo, facultad, username, password_hash, rol)
VALUES ('Estudiante Ana', 'estana@unge.edu', 'Ingeniería', 'estana', '$2b$12$estHashDePrueba', 'estudiante')
ON CONFLICT (correo) DO NOTHING;
-- =========================================
-- USUARIOS DE PRUEBA CON CREDENCIALES Y ROLES
-- =========================================

-- Admin
INSERT INTO Usuarios (nombre, correo, facultad, username, password_hash, rol)
VALUES ('Admin Campus', 'admin@unge.edu', 'Administración', 'admin',
        '$2b$12$zB1yORRxY0Hq6SGWQFFIIuklBdeLRxulHU65qgk9BrDtnXXP8jJ8q', 'admin')
ON CONFLICT (correo) DO NOTHING;

-- Profesor
INSERT INTO Usuarios (nombre, correo, facultad, username, password_hash, rol)
VALUES ('Profesor Juan', 'profjuan@unge.edu', 'Ciencias Sociales', 'profjuan',
        '$2b$12$qbRdgTfCG.xBNq2jrODaTeFXs4WTdMgAOEY0J4257fyQ7pdWpBLCy', 'profesor')
ON CONFLICT (correo) DO NOTHING;

-- Estudiante
INSERT INTO Usuarios (nombre, correo, facultad, username, password_hash, rol)
VALUES ('Estudiante Ana', 'estana@unge.edu', 'Ingeniería', 'estana',
        '$2b$12$5hOLQ8spx4z78ic1dAXOdO.zJ9g57E95wMRif6Lk82EPTBx2BIzwm', 'estudiante')
ON CONFLICT (correo) DO NOTHING;
-- Reinicia la tabla y carga edificios reales del campus UNGE
TRUNCATE TABLE Edificios RESTART IDENTITY;

INSERT INTO Edificios (nombre, ubicacion) VALUES
('ENTRADA-PRINCIPAL', 'Campus UNGE'),
('RESIDENCIA-ESTUDIANTIL', 'Campus UNGE'),
('BIBLIOTECAS', 'Campus UNGE'),
('FACULTAD-DERECHO-Y-CIENCIAS-POLITICAS', 'Campus UNGE'),
('ENTRADA-LUBA', 'Campus UNGE'),
('FACULTAD-CIENCIAS-INFORMACION-FILOLOGIA', 'Campus UNGE'),
('FACULTAD-PEDAGOGIA-CIENCIAS-EDUCACION', 'Campus UNGE'),
('FACULTAD-INGENIERIA-MEDIO-AMBIENTE', 'Campus UNGE'),
('FACULTAD-C-ECONOMICAS-GESTION-ADMINISTRACION', 'Campus UNGE'),
('F-HUMANIDADES-Y-CIENCIAS-RELIGIOSAS', 'Campus UNGE'),
('LABORATORIOS', 'Campus UNGE'),
('RECTORADO', 'Campus UNGE'),
('RESIDENCIA-PROFESORES-EDIF14', 'Campus UNGE'),
('RESIDENCIA-PROFESORES-EDIF15', 'Campus UNGE'),
('SALA-ACTIVIDADES-CULTURALES', 'Campus UNGE'),
('SALA-DE-RECOGIDA-DE-RESIDUOS-CAMPOS', 'Campus UNGE');


-- Departamentos de prueba
INSERT INTO Departamentos (nombre) VALUES
('Ingeniería'),
('Ciencias Sociales'),
('Educación'),
('Informática');

-- Carreras de prueba
INSERT INTO Carreras (nombre) VALUES
('Ingeniería Informática'),
('Pedagogía'),
('Derecho'),
('Economía');

-- Asignaturas de prueba
INSERT INTO Asignaturas (nombre) VALUES
('Matemáticas'),
('Física'),
('Historia');

-- Relacionar profesores con asignaturas
INSERT INTO Profesor_Asignatura (id_profesor, id_asignatura) VALUES
(1, 1), -- Profesor 1 imparte Matemáticas
(1, 2), -- Profesor 1 imparte Física
(2, 3); -- Profesor 2 imparte Historia

-- Registrar asistencia de profesores
INSERT INTO Asistencias_Profesores (id_profesor, id_aula, estado)
VALUES (1, 1, 'presente');


-- Crear QR para Aula 1 válido del 28 julio al 3 agosto
INSERT INTO Aula_QR (id_aula, codigo_qr, fecha_inicio, fecha_fin)
VALUES (1, 'AULA1-SEMANA-2026-07-28', '2026-07-28', '2026-08-03');

-- Profesor 1 ficha asistencia escaneando ese QR
INSERT INTO Asistencias_Profesores (id_profesor, id_qr, estado)
VALUES (1, 1, 'presente');

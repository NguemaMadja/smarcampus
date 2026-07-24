-- =========================================
-- Base de datos SmartCampus
-- =========================================

-- Usuarios
DROP TABLE IF EXISTS Usuarios CASCADE;
CREATE TABLE Usuarios (
    id_usuario SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    correo VARCHAR(100) UNIQUE NOT NULL,
    facultad VARCHAR(100)
);

-- Registro (credenciales)
DROP TABLE IF EXISTS Registro CASCADE;
CREATE TABLE Registro (
    id_registro SERIAL PRIMARY KEY,
    id_usuario INT REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(200) NOT NULL,
    rol VARCHAR(20) CHECK (rol IN ('admin','profesor','estudiante'))
);

-- Profesores
DROP TABLE IF EXISTS Profesores CASCADE;
CREATE TABLE Profesores (
    id_profesor SERIAL PRIMARY KEY,
    id_usuario INT REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
    departamento VARCHAR(100)
);

-- Estudiantes
DROP TABLE IF EXISTS Estudiantes CASCADE;
CREATE TABLE Estudiantes (
    id_estudiante SERIAL PRIMARY KEY,
    id_usuario INT REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
    matricula VARCHAR(50) UNIQUE
);

-- Asignaturas
DROP TABLE IF EXISTS Asignaturas CASCADE;
CREATE TABLE Asignaturas (
    id_asignatura SERIAL PRIMARY KEY,
    nombre VARCHAR(100),
    id_profesor INT REFERENCES Profesores(id_profesor)
);

-- Edificios
DROP TABLE IF EXISTS Edificios CASCADE;
CREATE TABLE Edificios (
    id_edificio SERIAL PRIMARY KEY,
    nombre VARCHAR(100),
    ubicacion VARCHAR(200)
);

-- Aulas
DROP TABLE IF EXISTS Aulas CASCADE;
CREATE TABLE Aulas (
    id_aula SERIAL PRIMARY KEY,
    nombre VARCHAR(50),
    capacidad INT,
    id_edificio INT REFERENCES Edificios(id_edificio)
);

-- Sensores
DROP TABLE IF EXISTS Sensores CASCADE;
CREATE TABLE Sensores (
    id_sensor SERIAL PRIMARY KEY,
    tipo VARCHAR(50),
    id_aula INT REFERENCES Aulas(id_aula)
);

-- Mediciones Ambientales
DROP TABLE IF EXISTS MedicionesAmbientales CASCADE;
CREATE TABLE MedicionesAmbientales (
    id_medicion SERIAL PRIMARY KEY,
    id_sensor INT REFERENCES Sensores(id_sensor),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valor NUMERIC
);

-- Métricas WiFi detalladas
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

-- Asistencia (solo para profesores, con hora exacta)
DROP TABLE IF EXISTS Asistencia CASCADE;
CREATE TABLE Asistencia (
    id_asistencia SERIAL PRIMARY KEY,
    id_profesor INT REFERENCES Profesores(id_profesor),
    id_aula INT REFERENCES Aulas(id_aula),
    id_asignatura INT REFERENCES Asignaturas(id_asignatura),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- incluye fecha y hora
    metodo VARCHAR(50) DEFAULT 'QR'
);

-- Transporte Escolar
DROP TABLE IF EXISTS TransporteEscolar CASCADE;
CREATE TABLE TransporteEscolar (
    id_transporte SERIAL PRIMARY KEY,
    ruta VARCHAR(100),
    capacidad INT
);

-- Radio UNGE
DROP TABLE IF EXISTS RadioUNGE CASCADE;
CREATE TABLE RadioUNGE (
    id_radio SERIAL PRIMARY KEY,
    programa VARCHAR(100),
    horario VARCHAR(50)
);

-- Materiales
DROP TABLE IF EXISTS Materiales CASCADE;
CREATE TABLE Materiales (
    id_material SERIAL PRIMARY KEY,
    nombre VARCHAR(100),
    tipo VARCHAR(50),
    id_asignatura INT REFERENCES Asignaturas(id_asignatura)
);

-- Visitas App
DROP TABLE IF EXISTS VisitasApp CASCADE;
CREATE TABLE VisitasApp (
    id_visita SERIAL PRIMARY KEY,
    id_usuario INT REFERENCES Usuarios(id_usuario),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alertas
DROP TABLE IF EXISTS Alertas CASCADE;
CREATE TABLE Alertas (
    id_alerta SERIAL PRIMARY KEY,
    mensaje VARCHAR(200),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Logs de Actividad
DROP TABLE IF EXISTS LogsActividad CASCADE;
CREATE TABLE LogsActividad (
    id_log SERIAL PRIMARY KEY,
    id_usuario INT REFERENCES Usuarios(id_usuario),
    accion VARCHAR(200),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Mapa
DROP TABLE IF EXISTS Mapa CASCADE;
CREATE TABLE Mapa (
    id_mapa SERIAL PRIMARY KEY,
    id_edificio INT REFERENCES Edificios(id_edificio) ON DELETE CASCADE,
    coordenadas VARCHAR(200) NOT NULL,
    foto BYTEA,
    ruta_foto VARCHAR(300)
);

-- =========================================
-- Inserciones de prueba de usuarios
-- =========================================
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

-- =========================================
-- Inserciones de edificios con coordenadas y rutas de fotos
-- =========================================

-- Inserciones de edificios con coordenadas y rutas de fotos

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


-- ============================================================
-- FECHA: 2026-07-10
-- CAMBIO: Agregar lista de verificación "Auditoría 2026"
-- Ejecutar sobre la base de datos sistemashaq.
-- ============================================================

USE sistemashaq;

CREATE TABLE IF NOT EXISTS auditoria_2026 (
  equipo_id BIGINT UNSIGNED NOT NULL,
  revision_software BOOLEAN NOT NULL DEFAULT FALSE,
  antivirus BOOLEAN NOT NULL DEFAULT FALSE,
  usb BOOLEAN NOT NULL DEFAULT FALSE,
  paginas_no_autorizadas BOOLEAN NOT NULL DEFAULT FALSE,
  escritorio BOOLEAN NOT NULL DEFAULT FALSE,
  tiempo_bloqueo BOOLEAN NOT NULL DEFAULT FALSE,
  glpi_antivirus BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (equipo_id),
  CONSTRAINT fk_auditoria_equipo FOREIGN KEY (equipo_id)
    REFERENCES equipos (id) ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Crea registros pendientes para los equipos que ya existían.
INSERT IGNORE INTO auditoria_2026 (equipo_id)
SELECT id FROM equipos;

-- ============================================================
-- FECHA: 2026-07-10
-- CAMBIO: Agregar "Bloqueo de configuración" y renombrar
--         "GLPI y antivirus" a "GLPI".
-- Ejecutar esta sección una sola vez si auditoria_2026 ya existe.
-- ============================================================

ALTER TABLE auditoria_2026
  ADD COLUMN bloqueo_configuracion BOOLEAN NOT NULL DEFAULT FALSE
    AFTER tiempo_bloqueo,
  CHANGE COLUMN glpi_antivirus glpi BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- FECHA: 2026-07-10
-- CAMBIO: Agregar responsable del equipo.
-- Los equipos existentes quedan temporalmente como "SIN ASIGNAR"
-- y pueden actualizarse posteriormente desde el sistema.
-- ============================================================

ALTER TABLE equipos
  ADD COLUMN responsable VARCHAR(150) NOT NULL DEFAULT 'SIN ASIGNAR'
    AFTER area;

-- ============================================================
-- FECHA: 2026-07-10
-- CAMBIO: Caché de información consultada a Lenovo por serial.
-- ============================================================

CREATE TABLE IF NOT EXISTS informacion_lenovo (
  equipo_id BIGINT UNSIGNED NOT NULL,
  modelo VARCHAR(255) NULL,
  mtm VARCHAR(100) NULL,
  familia VARCHAR(255) NULL,
  configuracion_original TEXT NULL,
  estado_garantia VARCHAR(100) NULL,
  inicio_garantia DATE NULL,
  fin_garantia DATE NULL,
  consultado_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (equipo_id),
  CONSTRAINT fk_lenovo_equipo FOREIGN KEY (equipo_id)
    REFERENCES equipos (id) ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

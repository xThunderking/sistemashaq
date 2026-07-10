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

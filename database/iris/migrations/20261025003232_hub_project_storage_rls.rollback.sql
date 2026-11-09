-- Contención de IRIS. No recupera los grants/políticas anónimos inseguros anteriores.
-- Mantiene las tablas protegidas y los datos intactos; la UI quedará sin acceso.
-- Sólo ejecutar si se autoriza retirar el verificador y se acuerda recuperación.
BEGIN;
ALTER ROLE authenticator RESET pgrst.db_pre_request;
NOTIFY pgrst, 'reload config';
COMMIT;

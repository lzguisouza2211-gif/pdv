--policy para adicionar sabores nos refrigerantes

CREATE POLICY "admin_insert_adicional"
ON adicional FOR INSERT
WITH CHECK (true);

CREATE POLICY "admin_update_adicional"
ON adicional FOR UPDATE
USING (true);

CREATE POLICY "admin_delete_adicional"
ON adicional FOR DELETE
USING (true);

-- Eliminar registro en transacciones cuando se aplica un abono.
-- Los abonos se manejan exclusivamente en la tabla `abonos` y solo
-- afectan el saldo del cliente. NO deben aparecer como ingresos del día,
-- porque el dinero ya entra físicamente a la caja y se cuadra en el arqueo.

CREATE OR REPLACE FUNCTION public.aplicar_abono(p_cliente uuid, p_monto numeric, p_metodo metodo_pago, p_empleado uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_restante numeric := p_monto;
  v_deuda RECORD;
  v_abono uuid;
BEGIN
  IF p_monto <= 0 THEN RAISE EXCEPTION 'Monto debe ser positivo'; END IF;

  -- Crear abono (sin generar transacción de ingreso)
  INSERT INTO public.abonos (cliente_id, monto, metodo_pago, empleado_id)
  VALUES (p_cliente, p_monto, p_metodo, p_empleado)
  RETURNING id INTO v_abono;

  -- FIFO: marcar deudas pendientes como pagadas hasta cubrir el monto
  FOR v_deuda IN
    SELECT id, monto FROM public.deudas
    WHERE cliente_id = p_cliente AND estado = 'pendiente'
    ORDER BY created_at ASC
  LOOP
    EXIT WHEN v_restante <= 0;
    IF v_deuda.monto <= v_restante THEN
      UPDATE public.deudas SET estado = 'pagado', pagado_at = now() WHERE id = v_deuda.id;
      v_restante := v_restante - v_deuda.monto;
    ELSE
      UPDATE public.deudas SET monto = monto - v_restante WHERE id = v_deuda.id;
      INSERT INTO public.deudas (cliente_id, producto_id, producto_nombre, precio_unitario, cantidad, monto, estado, empleado_id, pagado_at, created_at)
      SELECT cliente_id, producto_id, producto_nombre, precio_unitario, cantidad, v_restante, 'pagado', p_empleado, now(), created_at - interval '1 millisecond'
      FROM public.deudas WHERE id = v_deuda.id;
      v_restante := 0;
    END IF;
  END LOOP;

  PERFORM public.recalcular_saldo_cliente(p_cliente);
  RETURN v_abono;
END;
$function$;

-- Limpiar transacciones existentes generadas por abonos previos para evitar
-- duplicación histórica en los reportes diarios.
DELETE FROM public.transacciones WHERE origen = 'abono';
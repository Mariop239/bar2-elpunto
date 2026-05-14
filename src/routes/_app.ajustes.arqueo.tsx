import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/page-transition";
import { Calculator, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_app/ajustes/arqueo")({
  component: ArqueoPage,
});

const num = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmt = (n: number) => `$ ${n.toFixed(2)}`;

type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
};

function MoneyField({ id, label, value, onChange, hint }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        placeholder="0.00"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 text-base"
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ArqueoPage() {
  const [cajaInicial, setCajaInicial] = useState("");
  const [totalEgresos, setTotalEgresos] = useState("");
  const [bancoGuayaquil, setBancoGuayaquil] = useState("");
  const [bancoPichincha, setBancoPichincha] = useState("");
  const [arqueoBilletes, setArqueoBilletes] = useState("");
  const [valorMonedas1, setValorMonedas1] = useState("");
  const [valorMonedas50, setValorMonedas50] = useState("");
  const [valorMonedas25, setValorMonedas25] = useState("");
  const [valorMonedas10, setValorMonedas10] = useState("");
  const [valorMonedas5, setValorMonedas5] = useState("");

  const calc = useMemo(() => {
    const ci = num(cajaInicial);
    const te = num(totalEgresos);
    const arqueoBancos = num(bancoGuayaquil) + num(bancoPichincha);
    const ab = num(arqueoBilletes);
    const v1 = num(valorMonedas1);
    const v50 = num(valorMonedas50);
    const v25 = num(valorMonedas25);
    const v10 = num(valorMonedas10);
    const v5 = num(valorMonedas5);

    const totalMonedas = v1 + v50 + v25 + v10 + v5;
    const totalArqueoCaja = arqueoBancos + ab + totalMonedas;
    const cajaMenosEgresos = ci - te;
    const ventaDelDia = totalArqueoCaja - cajaMenosEgresos;

    return { arqueoBancos, totalMonedas, totalArqueoCaja, cajaMenosEgresos, ventaDelDia };
  }, [
    cajaInicial, totalEgresos, bancoGuayaquil, bancoPichincha, arqueoBilletes,
    valorMonedas1, valorMonedas50, valorMonedas25, valorMonedas10, valorMonedas5,
  ]);

  const reset = () => {
    setCajaInicial(""); setTotalEgresos("");
    setBancoGuayaquil(""); setBancoPichincha("");
    setArqueoBilletes("");
    setValorMonedas1(""); setValorMonedas50(""); setValorMonedas25("");
    setValorMonedas10(""); setValorMonedas5("");
  };

  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Calculator className="h-5 w-5" /> Arqueo / Cierre de Caja
            </h3>
            <p className="text-xs text-muted-foreground">Ingresa el valor en dólares de cada concepto.</p>
          </div>
          <Button variant="outline" size="sm" onClick={reset}>
            <RefreshCw className="h-4 w-4 mr-1" /> Limpiar
          </Button>
        </div>

        <Card className="p-4 rounded-xl shadow-sm space-y-3">
          <h4 className="font-semibold text-sm">Datos de caja</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <MoneyField id="cajaInicial" label="Caja inicial ($)" value={cajaInicial} onChange={setCajaInicial} />
            <MoneyField id="totalEgresos" label="Total egresos del día ($)" value={totalEgresos} onChange={setTotalEgresos} />
          </div>
        </Card>

        <Card className="p-4 rounded-xl shadow-sm space-y-4">
          <h4 className="font-semibold text-sm">Arqueo físico y digital</h4>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bancos</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <MoneyField id="bgye" label="Banco Guayaquil ($)" value={bancoGuayaquil} onChange={setBancoGuayaquil} />
              <MoneyField id="bpic" label="Banco Pichincha ($)" value={bancoPichincha} onChange={setBancoPichincha} />
            </div>
            <p className="text-xs text-right text-muted-foreground">
              Subtotal bancos: <span className="font-semibold text-foreground">{fmt(calc.arqueoBancos)}</span>
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Billetes</p>
            <MoneyField id="billetes" label="Total ($) en billetes físicos" value={arqueoBilletes} onChange={setArqueoBilletes} />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Monedas (valor en $)</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <MoneyField id="m1" label="Total ($) en monedas de $1" value={valorMonedas1} onChange={setValorMonedas1} />
              <MoneyField id="m50" label="Total ($) en monedas de 50ctvs" value={valorMonedas50} onChange={setValorMonedas50} />
              <MoneyField id="m25" label="Total ($) en monedas de 25ctvs" value={valorMonedas25} onChange={setValorMonedas25} />
              <MoneyField id="m10" label="Total ($) en monedas de 10ctvs" value={valorMonedas10} onChange={setValorMonedas10} />
              <MoneyField id="m5" label="Total ($) en monedas de 5ctvs" value={valorMonedas5} onChange={setValorMonedas5} />
            </div>
            <p className="text-xs text-right text-muted-foreground">
              Subtotal monedas: <span className="font-semibold text-foreground">{fmt(calc.totalMonedas)}</span>
            </p>
          </div>

          <div className="border-t pt-3 flex items-center justify-between">
            <span className="text-sm font-medium">Total Arqueo Caja</span>
            <span className="text-lg font-bold">{fmt(calc.totalArqueoCaja)}</span>
          </div>
        </Card>

        <Card className="p-6 rounded-xl border-2 border-primary bg-primary/10 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Resultado</p>
          <p className="mt-1 text-sm">Total Venta del Día</p>
          <p className="mt-2 text-4xl font-extrabold text-primary">
            $ {calc.ventaDelDia.toFixed(2)}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Caja − Egresos = <span className="font-semibold text-foreground">{fmt(calc.cajaMenosEgresos)}</span>
            {"  ·  "}
            Arqueo − (Caja − Egresos) = Venta
          </p>
        </Card>
      </div>
    </PageTransition>
  );
}

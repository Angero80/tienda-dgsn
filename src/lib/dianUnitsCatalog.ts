import { supabase } from './supabaseClient';

export type DianUnit = {
  id: number;
  code: string;
  name: string;
  active: boolean;
};

// El catálogo tiene ~1087 filas. Supabase/PostgREST impone un tope de filas
// por respuesta (típicamente 1000) sin importar el .range() pedido, así que
// paginamos en bloques de 1000 hasta que una página venga incompleta.
// Mismo patrón usado en /admin/config/dian-units/page.tsx.
export async function fetchAllDianUnits(): Promise<DianUnit[]> {
  const PAGE_SIZE = 1000;
  let allRows: DianUnit[] = [];
  let from = 0;
  let keepGoing = true;

  while (keepGoing) {
    const { data, error } = await supabase
      .from('dian_units_catalog')
      .select('id, code, name, active')
      .order('id')
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    allRows = allRows.concat(data || []);

    if (!data || data.length < PAGE_SIZE) {
      keepGoing = false;
    } else {
      from += PAGE_SIZE;
    }
  }

  return allRows;
}

export async function activateDianUnit(id: number): Promise<void> {
  const { error } = await supabase
    .from('dian_units_catalog')
    .update({ active: true })
    .eq('id', id);

  if (error) throw error;
}
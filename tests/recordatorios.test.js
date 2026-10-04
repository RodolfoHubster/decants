import { urlGoogleCalendar, reglaRecurrencia, proximaVez, ordenarRecordatorios, formatoCalendar } from '../assets/js/recordatorios.js';

describe('urlGoogleCalendar', () => {
  test('arma el evento con hora local, zona de Tijuana y repetición', () => {
    const url = new URL(urlGoogleCalendar({
      titulo: 'Renovar stock', detalle: 'Revisar Hoy', inicio: new Date(2026, 9, 4, 9, 0).getTime(), frecuencia: 'semanal',
    }));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('Renovar stock');
    expect(url.searchParams.get('dates')).toBe('20261004T090000/20261004T091500');
    expect(url.searchParams.get('ctz')).toBe('America/Tijuana');
    expect(url.searchParams.get('recur')).toBe('RRULE:FREQ=WEEKLY');
  });
  test('una sola vez no lleva repetición', () => {
    const url = new URL(urlGoogleCalendar({ titulo: 'x', inicio: new Date(2026, 0, 1, 8, 5) }));
    expect(url.searchParams.get('recur')).toBeNull();
    expect(formatoCalendar(new Date(2026, 0, 1, 8, 5))).toBe('20260101T080500');
  });
  test('reglas', () => {
    expect(reglaRecurrencia('quincenal')).toBe('RRULE:FREQ=WEEKLY;INTERVAL=2');
    expect(reglaRecurrencia('mensual')).toBe('RRULE:FREQ=MONTHLY');
    expect(reglaRecurrencia('una')).toBe('');
  });
});

describe('proximaVez', () => {
  const ahora = new Date(2026, 9, 3, 21, 0).getTime(); // sábado 3 oct, 9 pm
  test('semanal que empezó hace semanas cae en el próximo sábado', () => {
    const r = proximaVez({ inicio: new Date(2026, 8, 5, 10, 0).getTime(), frecuencia: 'semanal' }, ahora);
    expect(new Date(r)).toEqual(new Date(2026, 9, 10, 10, 0));
  });
  test('mensual respeta el día del mes', () => {
    const r = proximaVez({ inicio: new Date(2026, 6, 15, 9, 0).getTime(), frecuencia: 'mensual' }, ahora);
    expect(new Date(r)).toEqual(new Date(2026, 9, 15, 9, 0));
  });
  test('de una vez: futuro se queda, pasado es null', () => {
    expect(proximaVez({ inicio: ahora + 1000, frecuencia: 'una' }, ahora)).toBe(ahora + 1000);
    expect(proximaVez({ inicio: ahora - 1000, frecuencia: 'una' }, ahora)).toBeNull();
  });
  test('ordena por lo que toca primero', () => {
    const lista = ordenarRecordatorios([
      { id: 'a', inicio: ahora - 1000, frecuencia: 'una' },
      { id: 'b', inicio: ahora + 5000, frecuencia: 'una' },
      { id: 'c', inicio: ahora - 86400000 + 3600000, frecuencia: 'diario' },
    ], ahora);
    expect(lista.map(r => r.id)).toEqual(['b', 'c', 'a']);
  });
});

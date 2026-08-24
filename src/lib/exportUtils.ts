import * as XLSX from 'xlsx';
import { RecognitionResult } from './types';

export function exportToExcel(data: RecognitionResult) {
  const wb = XLSX.utils.book_new();

  const sawnRows: any[] = [];
  sawnRows.push([`РАСЧЁТНАЯ ВЕДОМОСТЬ РАСПИЛОВКИ И ЗАРПЛАТЫ — СМЕНА ${data.metadata.shift_date} (${data.metadata.brigade || 'Бригада №1'})`]);
  sawnRows.push([]);
  sawnRows.push(["Размер", "1 Сорт (шт)", "Объем 1с (м³)", "2 Сорт (шт)", "Объем 2с (м³)", "Итого шт", "Итого объем (м³)"]);

  data.standard_table.forEach((row) => {
    if (row.is_filled) {
      sawnRows.push([
        row.size,
        row.grade1_count || "-",
        row.grade1_vol_m3 ? row.grade1_vol_m3.toFixed(4) : "-",
        row.grade2_count || "-",
        row.grade2_vol_m3 ? row.grade2_vol_m3.toFixed(4) : "-",
        (row.grade1_count || 0) + (row.grade2_count || 0),
        row.total_vol_m3.toFixed(4)
      ]);
    }
  });

  data.extra_items.forEach((item) => {
    if (item.count > 0) {
      sawnRows.push([
        `${item.name} (доп.)`,
        item.count,
        item.vol_m3.toFixed(4),
        "-",
        "-",
        item.count,
        item.vol_m3.toFixed(4)
      ]);
    }
  });

  sawnRows.push([]);
  sawnRows.push([
    "ИТОГО ПИЛОМАТЕРИАЛ:",
    data.summary.total_grade1_count,
    data.summary.total_grade1_volume_m3.toFixed(3),
    data.summary.total_grade2_count,
    data.summary.total_grade2_volume_m3.toFixed(3),
    data.summary.total_pieces,
    data.summary.total_sawn_volume_m3.toFixed(3)
  ]);

  sawnRows.push([]);
  sawnRows.push(["=== РАСЧЁТ ЗАРПЛАТЫ БРИГАДЫ ==="]);
  sawnRows.push([
    "Готовая продукция (кубатура):",
    `${data.summary.salary.sawn_base_volume_m3} м³`,
    `Ставка: ${data.summary.salary.sawn_rate_per_m3} руб/м³`,
    `= ${data.summary.salary.sawn_salary_rub} руб`
  ]);
  sawnRows.push([
    "Горбыль 2м (штакет/доска):",
    `${data.summary.salary.slab_count} шт`,
    `Ставка: ${data.summary.salary.slab_rate_per_piece} руб/шт`,
    `= ${data.summary.salary.slab_salary_rub} руб`
  ]);
  sawnRows.push([
    "ИТОГО К ВЫПЛАТЕ БРИГАДЕ:",
    "",
    "",
    `${data.summary.salary.total_salary_rub} РУБЛЕЙ`
  ]);

  sawnRows.push([]);
  sawnRows.push([`КРУГЛЯК (СЫРЬЁ): ${data.summary.total_logs_count} шт. = ${data.summary.total_logs_volume_m3} м³`]);
  sawnRows.push([`ВЫХОД ГОТОВОЙ ПРОДУКЦИИ: ${data.summary.yield_percent}% (округление в меньшую сторону, точный: ${data.summary.raw_yield_percent}%)`]);

  const wsSawn = XLSX.utils.aoa_to_sheet(sawnRows);
  XLSX.utils.book_append_sheet(wb, wsSawn, "Сводка и Зарплата");

  // Logs breakdown sheet
  const logRows: any[] = [];
  logRows.push([`УЧЁТ КРУГЛЯКА (ГОСТ 2708-75, 6м) — ${data.metadata.shift_date}`]);
  logRows.push([]);
  logRows.push(["№ п/п", "Диаметр (см)", "Длина (м)", "Объем (м³)"]);

  data.roundwood_logs.breakdown.forEach((item, idx) => {
    logRows.push([idx + 1, item.diameter, 6.0, item.volume_m3]);
  });

  logRows.push([]);
  logRows.push(["ИТОГО КРУГЛЯК:", `${data.roundwood_logs.count} шт.`, "", `${data.roundwood_logs.total_volume_m3} м³`]);

  const wsLogs = XLSX.utils.aoa_to_sheet(logRows);
  XLSX.utils.book_append_sheet(wb, wsLogs, "Кругляк");

  XLSX.writeFile(wb, `zarplata_les_${data.metadata.shift_date.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
}

export function exportToCSV(data: RecognitionResult) {
  let csv = `Размер;1 Сорт (шт);Объем 1с (м3);2 Сорт (шт);Объем 2с (м3);Итого шт;Итого м3\n`;

  data.standard_table.forEach((row) => {
    if (row.is_filled) {
      csv += `${row.size};${row.grade1_count || 0};${row.grade1_vol_m3 || 0};${row.grade2_count || 0};${row.grade2_vol_m3 || 0};${(row.grade1_count || 0) + (row.grade2_count || 0)};${row.total_vol_m3}\n`;
    }
  });

  data.extra_items.forEach((item) => {
    csv += `${item.name};${item.count};${item.vol_m3};0;0;${item.count};${item.vol_m3}\n`;
  });

  csv += `ИТОГО ПИЛОМАТЕРИАЛ;${data.summary.total_grade1_count};${data.summary.total_grade1_volume_m3};${data.summary.total_grade2_count};${data.summary.total_grade2_volume_m3};${data.summary.total_pieces};${data.summary.total_sawn_volume_m3}\n`;
  csv += `ЗАРПЛАТА ЗА КУБАТУРУ (${data.summary.salary.sawn_rate_per_m3} руб/м3);;;;;;${data.summary.salary.sawn_salary_rub} руб\n`;
  csv += `ЗАРПЛАТА ЗА ГОРБЫЛЬ (${data.summary.salary.slab_count} шт * ${data.summary.salary.slab_rate_per_piece} руб);;;;;;${data.summary.salary.slab_salary_rub} руб\n`;
  csv += `ИТОГО ЗАРПЛАТА К ВЫДАЧЕ;;;;;;${data.summary.salary.total_salary_rub} руб\n`;
  csv += `ИТОГО КРУГЛЯК;${data.summary.total_logs_count} шт.;${data.summary.total_logs_volume_m3} м3;;;;\n`;
  csv += `ПРОЦЕНТ ВЫХОДА;${data.summary.yield_percent}%;;;;;\n`;

  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `zarplata_${data.metadata.shift_date}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadCSV(filename: string, headers: string[], rows: any[][]) {
  // สร้าง CSV Content พร้อม UTF-8 BOM เพื่อให้ Excel เปิดภาษาไทยได้ไม่เพี้ยน
  const BOM = "\uFEFF";
  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => {
      // Escape เครื่องหมายคำพูด
      const cellString = cell !== null && cell !== undefined ? String(cell) : "";
      return `"${cellString.replace(/"/g, '""')}"`;
    }).join(","))
  ].join("\n");

  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

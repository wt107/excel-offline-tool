/**
 * 文件操作工具函数
 * Excel 离线工具 - 文件处理相关
 */

/**
 * 格式化文件大小显示
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的字符串，如 "1.50 MB"
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 清理文件名中的非法字符
 * @param {string} name - 原始文件名
 * @returns {string} 清理后的文件名
 */
export function sanitizeFileName(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}

/**
 * 生成唯一文件名（避免重复）
 * @param {string} fileName - 原始文件名
 * @param {string[]} existingNames - 已存在的文件名列表
 * @returns {string} 唯一的文件名
 */
export function ensureUniqueFileName(fileName, existingNames = []) {
  if (!existingNames.includes(fileName)) {
    return fileName;
  }

  const extIndex = fileName.lastIndexOf('.');
  const base = extIndex > -1 ? fileName.slice(0, extIndex) : fileName;
  const extension = extIndex > -1 ? fileName.slice(extIndex) : '';

  let counter = 1;
  let newName = `${base}_${counter}${extension}`;

  while (existingNames.includes(newName)) {
    counter++;
    newName = `${base}_${counter}${extension}`;
  }

  return newName;
}

/**
 * 生成文件唯一标识符
 * @param {File} file - 文件对象
 * @returns {string} 文件 ID
 */
export function getFileId(file) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

/**
 * 获取基础文件名（不含扩展名）
 * @param {string} fileName - 文件名
 * @returns {string} 基础文件名
 */
export function getBaseFileName(fileName) {
  return fileName.replace(/\.[^/.]+$/, '');

}

/**
 * 获取文件扩展名
 * @param {string} fileName - 文件名
 * @returns {string} 扩展名（小写）
 */
export function getFileExtension(fileName) {
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  return ext;
}

/**
 * 生成时间戳字符串
 * @returns {string} 时间戳，格式: YYYYMMDD_HHMMSS
 */
export function getTimestampString() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

/**
 * 验证文件类型是否为 Excel
 * @param {File} file - 文件对象
 * @returns {boolean} 是否为 Excel 文件
 */
export function isExcelFile(file) {
  const fileName = file.name.toLowerCase();
  return fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
}

/**
 * 通过魔术字节验证文件类型
 * @param {File} file - 文件对象
 * @returns {Promise<boolean>} 验证结果
 */
export async function validateExcelFileByMagicBytes(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const arr = new Uint8Array(e.target.result);

      // ZIP 格式 (XLSX): 50 4B 03 04
      const isZip = arr[0] === 0x50 && arr[1] === 0x4B &&
                    arr[2] === 0x03 && arr[3] === 0x04;

      // OLE 格式 (XLS): D0 CF 11 E0
      const isOle = arr[0] === 0xD0 && arr[1] === 0xCF &&
                    arr[2] === 0x11 && arr[3] === 0xE0;

      resolve(isZip || isOle);
    };

    reader.onerror = () => resolve(false);
    reader.readAsArrayBuffer(file.slice(0, 8));
  });
}

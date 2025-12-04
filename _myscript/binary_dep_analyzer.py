import os
import sys
import pefile
import json
import argparse
from typing import Set, List

sys.path.append(os.getcwd())

try:
    from PyQt5.QtWidgets import QApplication, QFileDialog, QWidget
except ImportError:
    QApplication = None
    QFileDialog = None
    QWidget = None

def get_imported_dlls(file_path: str) -> Set[str]:
    try:
        pe = pefile.PE(file_path)
        dlls = set()
        if hasattr(pe, 'DIRECTORY_ENTRY_IMPORT'):
            for entry in pe.DIRECTORY_ENTRY_IMPORT:
                dlls.add(entry.dll.decode('utf-8').lower())
        return dlls
    except Exception as e:
        print(f"分析 {file_path} 失败: {e}")
        return set()

def collect_all_deps(start_files: List[str], search_dirs: List[str]) -> Set[str]:
    checked = set()
    to_check = set(start_files)
    all_found = set(start_files)

    while to_check:
        f = to_check.pop()
        if f in checked:
            continue
        checked.add(f)
        dlls = get_imported_dlls(f)
        for dll in dlls:
            for d in search_dirs:
                dll_path = os.path.join(d, dll)
                if os.path.exists(dll_path):
                    if dll_path not in checked:
                        to_check.add(dll_path)
                        all_found.add(dll_path)
    return all_found

def save_deps(deps: Set[str], output_file: str):
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    # 统一为正斜杠和小写，最后去重
    deps_norm = set(p.replace('\\', '/').lower() for p in deps)
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(sorted(deps_norm), f, ensure_ascii=False, indent=2)

def load_deps(input_file: str) -> Set[str]:
    if not os.path.exists(input_file):
        return set()
    with open(input_file, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
            return set(data)
        except Exception as e:
            print(f"读取 {input_file} 失败: {e}")
            return set()

def main():
    parser = argparse.ArgumentParser(description='递归分析二进制依赖')
    parser.add_argument('--files', nargs='*', help='要分析的exe/dll文件')
    parser.add_argument('--output', type=str, default='.config/binary_deps.json', help='输出文件')
    parser.add_argument('--gui', action='store_true', help='用界面选择文件')
    args = parser.parse_args()

    files = args.files or []
    if args.gui:
        if QApplication is None:
            print('未安装PyQt5，无法使用GUI选择文件')
            sys.exit(1)
        app = QApplication(sys.argv)
        widget = QWidget()
        file_list, _ = QFileDialog.getOpenFileNames(widget, '选择exe/dll文件', os.getcwd(), '可执行文件 (*.exe *.dll)')
        files.extend(file_list)
        if not files:
            print('未选择文件')
            sys.exit(0)
    if not files:
        print('请通过--files参数或--gui选择要分析的文件')
        sys.exit(1)
    search_dirs = list({os.path.dirname(f) for f in files})
    deps = collect_all_deps(files, search_dirs)
    # 合并已有内容
    if os.path.exists(args.output):
        old_deps = load_deps(args.output)
        deps = deps | old_deps
    save_deps(deps, args.output)
    print(f'已保存依赖到 {args.output}')

if __name__ == '__main__':
    main() 
"""
生成requirements.txt文件

使用方法：
    python myscript/1_requirements.py                # 默认合并模式（保留已有依赖）
    python myscript/1_requirements.py --overwrite    # 覆盖模式（删除已有依赖）

逻辑：
    1. 确保必要头文件
        stdlib_list
    2. 检测是否有./.config/myenv.json,没有则创建
    3. 检测是否有这些参数,没有则补上,参数的默认配置都在头文件下的宏定义：
        - import2pip: 对象(map),表示自动识别到的头文件,使用pip安装应该是什么名字,没有就是原名
        - import_ignore_folder: 数组,表示搜索头文件时应该避开哪些目录
        - import_ignore_file: 数组,表示搜索头文件时应该避开哪些文件
        - import_src: 数组,默认为空,如果填了,那么只搜索这个指定目录
    4. 读取配置文件
    5. 先扫一遍目录,将本地的py文件和包目录记录,防止被误识别成import（也根据参数来过滤）
    6. AST语义分析,找出所有import,去掉python自带的（stdlib和下划线开头的等）,并过滤掉本地
    7. 默认合并模式：保留已有requirements.txt中的依赖,只添加新发现的
    8. 写入时借助import2pip来转换成pip名字

"""

import os
import sys
import json
import ast
import subprocess
import re

# 配置文件路径
CONFIG_FILE = '.config/myenv.json'
# 默认配置
DEFAULT_CONFIG = {
    "import2pip": {
        "pkg_resources": "setuptools",
        "cv2": "opencv-python",
        "PIL": "Pillow",
        "bs4": "beautifulsoup4",
        "yaml": "PyYAML",
        "sklearn": "scikit-learn",
        "docx": "python-docx",
    },
    "import_ignore_folder": [".misc", ".venv", "venv", "virtualenv", "__pycache__", ".git", ".build_output_dir", "dist", "build"],
    "import_ignore_file": ["setup.py", "__init__.py", "0_venv.py", "1_requirements.py", "2_install_import.py", "mypackage.py"],
    "import_src": []
}

def ensure_stdlib_list():
    """确保stdlib_list已安装,类似于0_venv.py的ensure_virtualenv"""
    try:
        from stdlib_list import stdlib_list
        return True, ''
    except ImportError:
        try:
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'stdlib_list'])
            from stdlib_list import stdlib_list
            return True, '已安装stdlib_list'
        except Exception as e:
            return False, f'stdlib_list安装失败: {e}'

def ensure_config_file(config_path=None):
    """确保配置文件存在,不存在则创建"""
    if config_path is None:
        config_path = CONFIG_FILE
    
    config_dir = os.path.dirname(config_path)
    if config_dir:
        os.makedirs(config_dir, exist_ok=True)
    
    if not os.path.exists(config_path):
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(DEFAULT_CONFIG, f, ensure_ascii=False, indent=4)
        return True, f'已创建配置文件: {config_path}'
    return False, '配置文件已存在'

def load_config(config_path=None):
    """读取配置文件,确保所有必需参数存在"""
    if config_path is None:
        config_path = CONFIG_FILE
    
    # 确保配置文件存在
    ensure_config_file(config_path)
    
    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)
    
    # 检查并补充缺失的参数
    updated = False
    for key, default_value in DEFAULT_CONFIG.items():
        if key not in config:
            config[key] = default_value
            updated = True
    
    # 如果有更新,写回配置文件
    if updated:
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=4)
        print(f'已更新配置文件: {config_path}')
    
    return config

def get_local_modules(project_path, ignore_folders, ignore_files):
    """扫描一遍目录,记录本地的py文件和包目录,防止被误识别成import"""
    local_modules = set()
    local_packages = set()
    
    for root, dirs, files in os.walk(project_path):
        # 过滤忽略的文件夹
        dirs[:] = [d for d in dirs if d not in ignore_folders]
        
        # 记录当前目录下的包（包含.py文件或__init__.py的目录）
        for dir_name in dirs:
            dir_path = os.path.join(root, dir_name)
            # 检查目录是否包含.py文件（说明是一个Python包）
            try:
                dir_files = os.listdir(dir_path)
                has_py = any(f.endswith('.py') for f in dir_files)
                if has_py:
                    local_packages.add(dir_name)
            except:
                pass
        
        for file in files:
            # 过滤忽略的文件
            if file in ignore_files:
                continue
            if file.endswith('.py'):
                # 记录模块名（不带.py后缀）
                module_name = os.path.splitext(file)[0]
                local_modules.add(module_name)
    
    # 合并模块名和包名
    return local_modules | local_packages

def scan_imports(project_path, ignore_folders, ignore_files, import_src_dirs=None):
    """AST语义分析,找出所有import"""
    imports = {}  # {模块名: (文件路径, 行号)}
    
    # 如果指定了import_src,只扫描这些目录
    if import_src_dirs and len(import_src_dirs) > 0:
        scan_paths = [os.path.join(project_path, d) for d in import_src_dirs]
    else:
        scan_paths = [project_path]
    
    for scan_path in scan_paths:
        if not os.path.exists(scan_path):
            continue
            
        for root, dirs, files in os.walk(scan_path):
            # 过滤忽略的文件夹
            dirs[:] = [d for d in dirs if d not in ignore_folders]
            
            for file in files:
                # 过滤忽略的文件
                if file in ignore_files:
                    continue
                if file.endswith('.py'):
                    file_path = os.path.join(root, file)
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            tree = ast.parse(f.read(), filename=file)
                        
                        for node in ast.walk(tree):
                            # 处理 import xxx
                            if isinstance(node, ast.Import):
                                for n in node.names:
                                    if n.name not in imports:
                                        imports[n.name] = (file_path, node.lineno)
                            # 处理 from xxx import yyy
                            elif isinstance(node, ast.ImportFrom):
                                if node.module and node.module not in imports:
                                    imports[node.module] = (file_path, node.lineno)
                    except Exception as e:
                        # 忽略解析错误的文件
                        pass
    
    return imports

def extract_pkg_name(pkg_line):
    """提取包名（去掉版本号）
    支持: pyinstaller==6.9.0, pyinstaller>=6.9.0, pyinstaller<=6.9.0, pyinstaller~=6.9.0, pyinstaller
    """
    return re.split(r'[<>=~!]', pkg_line, maxsplit=1)[0].strip()

def filter_third_party(imports, local_modules, import2pip):
    """
    过滤第三方依赖
    去掉python自带的（stdlib和下划线开头的等）,并过滤掉本地
    借助import2pip来转换成pip名字
    """
    from stdlib_list import stdlib_list
    stdlib = set(stdlib_list(f"{sys.version_info.major}.{sys.version_info.minor}"))
    
    result = []  # [(pip包名, (文件路径, 行号))]
    
    for imp, src in imports.items():
        # 过滤标准库和下划线开头的
        if imp in stdlib or imp.startswith('_'):
            continue
        
        # 提取顶级模块名
        parts = imp.split('.')
        top_module = parts[0]
        
        # 过滤本地模块
        if top_module in local_modules:
            continue
        
        # 检查是否需要转换成pip包名
        if top_module in import2pip:
            pip_name = import2pip[top_module]
        else:
            pip_name = top_module
        
        # 去重
        if not any(x[0] == pip_name for x in result):
            result.append((pip_name, src))
    
    return result

def write_requirements(third_party_deps, output_file, overwrite=False):
    """生成或合并requirements.txt
    
    Args:
        third_party_deps: 新发现的第三方依赖列表
        output_file: 输出文件路径
        overwrite: True=覆盖模式,False=合并模式（默认,保留已有依赖）
    """
    # 默认是合并模式：读取现有依赖
    existing_reqs = set()
    existing_pkg_names = set()  # 已存在的包名（去掉版本号）
    if not overwrite and os.path.exists(output_file):
        with open(output_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    existing_reqs.add(line)
                    # 提取包名（去掉版本号）
                    pkg_name = extract_pkg_name(line)
                    existing_pkg_names.add(pkg_name)
    
    # 扫描到的依赖
    scanned_reqs = set(x[0] for x in third_party_deps)
    
    # 过滤掉已存在的包（按包名比较，不是按完整字符串）
    truly_new_reqs = set()
    for pkg in scanned_reqs:
        pkg_name = extract_pkg_name(pkg)
        if pkg_name not in existing_pkg_names:
            truly_new_reqs.add(pkg)
    
    # 合并所有依赖
    all_reqs = sorted(existing_reqs | truly_new_reqs)
    
    # 写入requirements.txt
    with open(output_file, 'w', encoding='utf-8') as f:
        for req in all_reqs:
            f.write(f'{req}\n')
    
    # 生成requirements_sources.json（记录每个依赖的来源，放在.config目录下）
    # 使用 set 来去重
    sources = {}
    for pkg_name, (file_path, lineno) in third_party_deps:
        source_entry = f"{file_path}:{lineno}"
        if pkg_name not in sources:
            sources[pkg_name] = set()
        sources[pkg_name].add(source_entry)
    
    # sources 文件放到 .config 目录下
    sources_path = os.path.join('.config', 'requirements_sources.json')
    os.makedirs('.config', exist_ok=True)
    
    # 如果不是覆盖模式,合并旧的sources（使用set去重）
    if not overwrite and os.path.exists(sources_path):
        try:
            with open(sources_path, 'r', encoding='utf-8') as f:
                old_sources = json.load(f)
            # 合并旧数据，使用set自动去重
            for k, v in old_sources.items():
                if k not in sources:
                    sources[k] = set()
                # v 可能是列表，转换成set合并
                if isinstance(v, list):
                    sources[k].update(v)
                else:
                    sources[k].add(v)
        except Exception as e:
            print(f'警告: 读取旧的sources文件失败: {e}')
    
    # 转换set为排序后的列表，便于阅读
    sources_for_json = {}
    for k, v in sources.items():
        sources_for_json[k] = sorted(list(v))
    
    # 按包名排序
    sources_for_json = dict(sorted(sources_for_json.items()))
    
    with open(sources_path, 'w', encoding='utf-8') as f:
        json.dump(sources_for_json, f, ensure_ascii=False, indent=2)
    
    # 返回统计信息
    total_count = len(all_reqs)
    existing_count = len(existing_reqs)
    new_count = len(truly_new_reqs)
    
    return total_count, existing_count, new_count

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='依赖扫描与requirements.txt生成')
    parser.add_argument('--project', type=str, default=os.getcwd(), help='项目根目录')
    parser.add_argument('--output', type=str, default='requirements.txt', help='输出requirements.txt文件名')
    parser.add_argument('--overwrite', action='store_true', help='覆盖模式（删除已有依赖）。默认为合并模式,保留已有依赖')
    parser.add_argument('--config', type=str, default=CONFIG_FILE, help=f'配置文件路径（默认: {CONFIG_FILE}）')
    args = parser.parse_args()
    
    # 1. 确保stdlib_list已安装（类似0_venv.py的ensure_virtualenv）
    ok, msg = ensure_stdlib_list()
    if not ok:
        print(f'错误: {msg}')
        sys.exit(1)
    if msg:
        print(msg)
    
    # 2. 读取或创建配置文件
    config = load_config(args.config)
    
    # 3. 先扫一遍目录,记录本地py文件,防止被误识别成import
    print(f'正在扫描项目本地模块: {args.project}')
    local_modules = get_local_modules(
        args.project,
        config['import_ignore_folder'],
        config['import_ignore_file']
    )
    print(f'找到 {len(local_modules)} 个本地模块')
    
    # 4. AST语义分析,找出所有import
    print(f'正在扫描项目导入语句: {args.project}')
    imports = scan_imports(
        args.project,
        config['import_ignore_folder'],
        config['import_ignore_file'],
        config['import_src']
    )
    
    if not imports:
        print('未扫描到导入语句')
        sys.exit(0)
    
    print(f'找到 {len(imports)} 个导入语句')
    
    # 5. 过滤第三方依赖
    print('正在过滤第三方依赖...')
    third_party_deps = filter_third_party(
        imports,
        local_modules,
        config['import2pip']
    )
    
    if not third_party_deps:
        print('未找到第三方依赖')
        sys.exit(0)
    
    # 6. 生成或合并requirements.txt
    total, existing_count, new_count = write_requirements(
        third_party_deps, 
        args.output, 
        overwrite=args.overwrite
    )
    
    if args.overwrite:
        print(f'✓ 已覆盖写入 {args.output},共 {total} 项依赖')
    else:
        if existing_count > 0:
            print(f'✓ 已合并写入 {args.output}')
            print(f'  - 原有依赖: {existing_count} 项')
            print(f'  - 找到依赖: {len(third_party_deps)} 项')
            print(f'  - 新增依赖: {new_count} 项')
            print(f'  - 总计依赖: {total} 项')
            if new_count == 0:
                print(f'  ℹ 所有扫描到的依赖都已存在,无需添加')
        else:
            print(f'✓ 已生成 {args.output},共 {total} 项依赖')
    
    # 显示新发现的依赖
    if third_party_deps:
        print('\n扫描到的依赖:')
        for pkg_name, (file_path, lineno) in third_party_deps:
            # 截断过长的路径
            short_path = file_path
            if len(file_path) > 50:
                short_path = '...' + file_path[-47:]
            print(f'  - {pkg_name:20s} ({short_path}:{lineno})')
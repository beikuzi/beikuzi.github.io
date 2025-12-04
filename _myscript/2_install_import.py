"""
对requirements.txt中的依赖进行安装

使用方法：
    python myscript/2_install_import.py              # 默认快速安装（跳过已安装）
    python myscript/2_install_import.py --full       # 完整安装（强制重装）
    python myscript/2_install_import.py --source 1   # 使用清华源

逻辑：
    1. 确保必要头文件
        packaging (用于版本号解析和比较)
    2. 检测是否有./.config/myenv.json,没有则创建
    3. 检测是否有这些参数,没有则补上,参数的默认配置：
        - pip_source: 数字,表示使用哪个pip源
          0 = 默认源
          1 = 清华源（默认）
          2 = 阿里源
          3 = 中科大源
        - pip_source_list: 对象,pip源列表,可自定义添加
          格式: {"0": {"name": "源名称", "url": "源URL"}, ...}
    4. 读取配置文件
    5. 如果requirements里面有提供版本,按照版本安装
    6. 支持快速模式（跳过已安装）和完整模式（强制重装）
    7. 记录失败日志,包含依赖来源信息
"""

import os
import sys
import json
import subprocess
import re
import argparse

# 配置文件路径
CONFIG_FILE = '.config/myenv.json'
VENV_PATH = '.venv'

# 默认配置（只添加pip相关配置，其他的由1_requirements.py管理）
DEFAULT_CONFIG_ADDON = {
    "pip_source": 1,
    "pip_source_list": {
        "0": {"name": "默认源", "url": None},
        "1": {"name": "清华源", "url": "https://pypi.tuna.tsinghua.edu.cn/simple"},
        "2": {"name": "阿里源", "url": "https://mirrors.aliyun.com/pypi/simple/"},
        "3": {"name": "中科大源", "url": "https://pypi.mirrors.ustc.edu.cn/simple/"}
    }
}

def ensure_packaging():
    """确保packaging已安装,类似于0_venv.py的ensure_virtualenv"""
    try:
        import packaging
        return True, ''
    except ImportError:
        try:
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'packaging'])
            import packaging
            return True, '已安装packaging'
        except Exception as e:
            return False, f'packaging安装失败: {e}'

def load_config(config_path=None):
    """读取配置文件,确保pip相关参数存在"""
    if config_path is None:
        config_path = CONFIG_FILE
    
    # 确保配置文件存在
    config_dir = os.path.dirname(config_path)
    if config_dir:
        os.makedirs(config_dir, exist_ok=True)
    
    config = {}
    if os.path.exists(config_path):
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
    
    # 检查并补充pip相关参数
    updated = False
    for key, default_value in DEFAULT_CONFIG_ADDON.items():
        if key not in config:
            config[key] = default_value
            updated = True
    
    # 如果有更新,写回配置文件
    if updated:
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=4)
        print(f'已更新配置文件: {config_path}')
    
    return config

def get_pip_source_url(config, source_index):
    """从配置中获取pip源URL
    
    Args:
        config: 配置字典
        source_index: 源编号
    
    Returns:
        (source_url, source_name) 或 (None, None)
    """
    pip_source_list = config.get('pip_source_list', {})
    source_key = str(source_index)
    
    if source_key in pip_source_list:
        source_info = pip_source_list[source_key]
        return source_info.get('url'), source_info.get('name', f'源{source_index}')
    
    return None, None

def extract_pkg_name(pkg_line):
    """提取包名（去掉版本号）
    支持: pyinstaller==6.9.0, pyinstaller>=6.9.0, pyinstaller<=6.9.0, pyinstaller~=6.9.0, pyinstaller
    """
    return re.split(r'[<>=~!]', pkg_line, maxsplit=1)[0].strip()

def extract_pkg_version(pkg_line):
    """提取版本号和操作符
    返回: (操作符, 版本号) 或 (None, None)
    """
    m = re.search(r'([<>=!~]+)\s*([\w\.]+)', pkg_line)
    if m:
        return m.group(1), m.group(2)
    return None, None

def get_installed_version(pip_path, pkg_name):
    """获取已安装的包版本"""
    try:
        output = subprocess.check_output(
            [pip_path, 'show', pkg_name], 
            stderr=subprocess.DEVNULL, 
            encoding='utf-8'
        )
        for line in output.splitlines():
            if line.lower().startswith('version:'):
                return line.split(':', 1)[1].strip()
    except Exception:
        return None
    return None

def is_pkg_installed(pip_path, pkg_name):
    """检查包是否已安装"""
    try:
        output = subprocess.check_output(
            [pip_path, 'show', pkg_name], 
            stderr=subprocess.DEVNULL
        )
        return bool(output)
    except Exception:
        return False

def is_version_satisfy(installed_version, op, target_version):
    """检查已安装版本是否满足要求"""
    if not installed_version or not op or not target_version:
        return False
    
    from packaging.version import Version
    from packaging.specifiers import SpecifierSet
    
    spec = f"{op}{target_version}"
    try:
        return Version(installed_version) in SpecifierSet(spec)
    except Exception:
        return False

def get_pip_path(venv_path):
    """获取虚拟环境中的pip路径"""
    pip_path = os.path.join(
        venv_path,
        'Scripts' if os.name == 'nt' else 'bin',
        'pip.exe' if os.name == 'nt' else 'pip'
    )
    return pip_path

def get_python_path(venv_path):
    """获取虚拟环境中的python路径"""
    python_path = os.path.join(
        venv_path,
        'Scripts' if os.name == 'nt' else 'bin',
        'python.exe' if os.name == 'nt' else 'python'
    )
    return python_path

def ensure_pip(venv_path):
    """确保pip存在,如果不存在尝试自动修复"""
    pip_path = get_pip_path(venv_path)
    python_path = get_python_path(venv_path)
    
    if os.path.isfile(pip_path):
        return True, pip_path
    
    # pip不存在,尝试修复
    if os.path.isfile(python_path):
        try:
            print('pip不存在,正在自动修复...')
            subprocess.check_call([python_path, '-m', 'ensurepip'])
            subprocess.check_call([python_path, '-m', 'pip', 'install', '--upgrade', 'pip'])
            if os.path.isfile(pip_path):
                return True, pip_path
        except Exception as e:
            return False, f'pip自动修复失败: {e}'
    
    return False, f'未找到pip,请确认虚拟环境已创建: {venv_path}'

def install_requirements(venv_path, req_file, log_file, pip_source=None, skip_installed=True):
    """
    安装requirements.txt中的依赖
    
    Args:
        venv_path: 虚拟环境路径
        req_file: requirements.txt路径
        log_file: 失败日志文件路径
        pip_source: pip源URL
        skip_installed: True=跳过已安装（快速模式）, False=强制重装（完整模式）
    
    Returns:
        (ok, msg, failed_list)
    """
    # 确保pip存在
    ok, result = ensure_pip(venv_path)
    if not ok:
        return False, result, []
    pip_path = result
    
    # 检查requirements.txt是否存在
    if not os.path.isfile(req_file):
        return False, f'未找到requirements.txt: {req_file}', []
    
    # 读取依赖列表
    with open(req_file, 'r', encoding='utf-8') as f:
        pkgs = [line.strip() for line in f if line.strip() and not line.strip().startswith('#')]
    
    if not pkgs:
        return True, '没有需要安装的依赖', []
    
    # 读取来源信息（从.config目录读取）
    sources_path = os.path.join('.config', 'requirements_sources.json')
    pkg_sources = {}
    if os.path.exists(sources_path):
        with open(sources_path, 'r', encoding='utf-8') as f:
            pkg_sources = json.load(f)
    
    # 安装依赖
    failed = []
    installed_count = 0
    skipped_count = 0
    
    print(f'\n开始安装 {len(pkgs)} 个依赖...')
    if skip_installed:
        print('模式: 快速安装（跳过已安装）\n')
    else:
        print('模式: 完整安装（强制重装）\n')
    
    for i, pkg in enumerate(pkgs, 1):
        pkg_name = extract_pkg_name(pkg)
        op, target_version = extract_pkg_version(pkg)
        
        print(f'[{i}/{len(pkgs)}] {pkg}', end=' ... ', flush=True)
        
        # 检查是否已安装
        if skip_installed and is_pkg_installed(pip_path, pkg_name):
            installed_version = get_installed_version(pip_path, pkg_name)
            
            if op and target_version:
                # 有版本要求,检查是否满足
                satisfy = is_version_satisfy(installed_version, op, target_version)
                if satisfy:
                    print(f'已安装 v{installed_version} ✓')
                    skipped_count += 1
                    continue
                else:
                    print(f'已安装 v{installed_version},不满足要求,重新安装', flush=True)
            else:
                # 没有版本要求,跳过
                print(f'已安装 v{installed_version} ✓')
                skipped_count += 1
                continue
        
        # 安装依赖
        try:
            cmd = [pip_path, 'install', pkg]
            if pip_source:
                cmd += ['-i', pip_source]
            
            subprocess.check_call(
                cmd, 
                stdout=subprocess.DEVNULL, 
                stderr=subprocess.PIPE
            )
            print('安装成功 ✓')
            installed_count += 1
        except subprocess.CalledProcessError as e:
            error_msg = e.stderr.decode('utf-8', errors='ignore') if e.stderr else str(e)
            print(f'安装失败 ✗')
            failed.append((pkg, error_msg))
    
    # 写入失败日志
    if failed:
        with open(log_file, 'w', encoding='utf-8') as logf:
            logf.write(f'依赖安装失败记录 (共{len(failed)}项)\n')
            logf.write('=' * 60 + '\n\n')
            for pkg, err in failed:
                logf.write(f'包名: {pkg}\n')
                # 写入来源信息
                pkg_name = extract_pkg_name(pkg)
                srcs = pkg_sources.get(pkg_name, [])
                if srcs:
                    logf.write(f'来源: {srcs[0]}\n')
                logf.write(f'错误: {err}\n')
                logf.write('-' * 60 + '\n\n')
        
        msg = f'\n安装完成: 成功 {installed_count} 项, 跳过 {skipped_count} 项, 失败 {len(failed)} 项\n详情见: {log_file}'
        return False, msg, [pkg for pkg, _ in failed]
    
    msg = f'\n✓ 安装完成: 成功 {installed_count} 项, 跳过 {skipped_count} 项'
    return True, msg, []

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='依赖安装工具')
    parser.add_argument('--venv', type=str, default=VENV_PATH, help=f'虚拟环境目录名（默认: {VENV_PATH}）')
    parser.add_argument('--req', type=str, default='requirements.txt', help='requirements.txt文件名')
    parser.add_argument('--log', type=str, default='install_failed.log', help='失败日志文件名')
    parser.add_argument('--source', type=int, default=None, help='pip源编号: 0=默认, 1=清华, 2=阿里, 3=中科大')
    parser.add_argument('--full', action='store_true', help='完整安装模式（强制重装所有依赖）')
    parser.add_argument('--config', type=str, default=CONFIG_FILE, help=f'配置文件路径（默认: {CONFIG_FILE}）')
    args = parser.parse_args()
    
    # 1. 确保packaging已安装
    ok, msg = ensure_packaging()
    if not ok:
        print(f'错误: {msg}')
        sys.exit(1)
    if msg:
        print(msg)
    
    # 2. 读取配置文件
    config = load_config(args.config)
    
    # 3. 确定pip源
    if args.source is not None:
        # 命令行指定的源优先
        pip_source, source_name = get_pip_source_url(config, args.source)
        if pip_source:
            print(f'使用pip源: {source_name} ({pip_source})')
        elif args.source == 0:
            print('使用pip默认源')
            pip_source = None
    else:
        # 使用配置文件中的源
        source_index = config.get('pip_source', 0)
        pip_source, source_name = get_pip_source_url(config, source_index)
        if pip_source:
            print(f'使用配置的pip源: {source_name} ({pip_source})')
        elif source_index == 0:
            print('使用pip默认源')
            pip_source = None
    
    # 4. 安装依赖
    skip_installed = not args.full  # full模式不跳过已安装
    
    ok, msg, failed = install_requirements(
        args.venv,
        args.req,
        args.log,
        pip_source,
        skip_installed
    )
    
    print(msg)
    
    if not ok:
        sys.exit(1)

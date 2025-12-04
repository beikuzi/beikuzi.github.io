"""
创建虚拟环境

使用方法
    python myscript/0_venv.py
    python myscript/0_venv.py --rebuild

逻辑
    1. 会先确保virtualenv已安装
    2. 判断是否存在虚拟环境，不存在则创建

"""

import os
import sys
import argparse
import subprocess
import shutil
import logging

VENV_PATH = '.venv'

def ensure_virtualenv():
    try:
        import virtualenv
        return True, ''
    except ImportError:
        try:
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'virtualenv'])
            import virtualenv
            return True, '已安装virtualenv'
        except Exception as e:
            return False, f'virtualenv安装失败: {e}'

def venv_exists(venv_path=VENV_PATH):
    python_path = os.path.join(venv_path, 'Scripts' if os.name == 'nt' else 'bin', 'python.exe' if os.name == 'nt' else 'python')
    return os.path.isdir(venv_path) and os.path.isfile(python_path)

def get_real_python():
    # 如果是PyInstaller打包的exe，优先用系统python
    if getattr(sys, 'frozen', False):
        python = shutil.which('python') or shutil.which('python3')
        if python:
            return python
    return sys.executable

def create_venv(venv_path=VENV_PATH):
    if venv_exists(venv_path):
        return True, '虚拟环境已存在'
    try:
        subprocess.check_call([get_real_python(), '-m', 'virtualenv', venv_path])
        return True, '虚拟环境创建成功'
    except Exception as e:
        return False, f'虚拟环境创建失败: {e}'

def is_venv_active():
    """检测当前是否在虚拟环境中运行"""
    return hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix)

def rebuild_venv(venv_path=VENV_PATH):
    """删除现有虚拟环境并重新创建"""
    # 检查是否在虚拟环境中运行
    if is_venv_active():
        venv_path_abs = os.path.abspath(venv_path)
        current_venv = os.path.abspath(sys.prefix)
        if os.path.normpath(venv_path_abs) == os.path.normpath(current_venv):
            return False, (
                '错误：无法删除当前正在使用的虚拟环境！\n'
                '请先退出虚拟环境后再运行此命令：\n'
                '  1. 运行: deactivate\n'
                '  2. 然后再运行: python myscript/0_venv.py --rebuild'
            )
    
    try:
        # 如果虚拟环境存在，先删除
        if os.path.exists(venv_path):
            print(f'正在删除现有虚拟环境: {venv_path}')
            shutil.rmtree(venv_path)
            print('删除成功')
        
        # 重新创建虚拟环境
        print(f'正在创建新的虚拟环境: {venv_path}')
        subprocess.check_call([get_real_python(), '-m', 'virtualenv', venv_path])
        return True, '虚拟环境重建成功'
    except PermissionError as e:
        return False, (
            f'权限错误：{e}\n'
            '可能原因：虚拟环境中的文件正在被使用\n'
            '解决方案：\n'
            '  1. 确保已退出虚拟环境 (运行 deactivate)\n'
            '  2. 关闭所有使用该虚拟环境的程序\n'
            '  3. 重试此命令'
        )
    except Exception as e:
        return False, f'虚拟环境重建失败: {e}'

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='虚拟环境管理工具')
    parser.add_argument('--venv', type=str, default=VENV_PATH, help='虚拟环境目录名')
    parser.add_argument('--check', action='store_true', help='仅检测虚拟环境是否存在')
    parser.add_argument('--rebuild', action='store_true', help='重新生成虚拟环境（删除现有环境并重新创建）')
    args = parser.parse_args()
    
     # 确保 virtualenv 已安装
    ok, msg = ensure_virtualenv()
    if not ok:
        print(f'错误: {msg}')
        sys.exit(1)
    if msg:
        print(msg)

    if args.check:
        print('存在' if venv_exists(args.venv) else '不存在')
    elif args.rebuild:
        ok, msg = rebuild_venv(args.venv)
        print(msg)
    else:
        ok, msg = create_venv(args.venv)
        print(msg) 
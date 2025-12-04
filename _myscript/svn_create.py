"""
在当前路径原地创建SVN远程仓库并检出

使用方法：
    python myscript/svn_create.py                # 在当前目录创建
    python myscript/svn_create.py --recover      # 重建模式（删除现有仓库和工作副本,然后重新创建）
    python myscript/svn_create.py --clean        # 清理模式（删除工作副本.svn和远程仓库）
    python myscript/svn_create.py --repo myrepo  # 指定仓库名

逻辑：
    1. 确保svn命令可用
    2. 检测是否有./.config/mysvn.json,没有则创建
    3. 检测是否有这些参数,没有则补上,参数的默认配置：
        - svn_fs_format: 仓库文件系统格式
        - svn_compatible_version: SVN兼容版本
        - svn_ignore_list: 数组,要忽略的文件/目录列表
        - repo_name: 仓库目录名（默认.misc/.svn_repo）
        - auto_commit_on_init: 布尔值,创建仓库后是否自动提交所有现有文件（默认True）
    4. 根据模式执行不同操作：
        - 普通模式：创建仓库并检出
        - recover模式：删除现有仓库和工作副本,重新创建
        - clean模式：只删除工作副本(.svn)和远程仓库
    5. 创建远程仓库（在.misc目录下）
    6. 导入初始结构（trunk/branches/tags）
    7. 在当前目录检出trunk
    8. 设置svn:ignore属性
    9. 如果auto_commit_on_init=True,自动添加并提交所有现有文件（会尊重忽略列表）

"""

import os
import sys
import json
import subprocess
import shutil
import argparse
import stat

# 配置文件路径
CONFIG_FILE = '.config/mysvn.json'

# 默认配置
DEFAULT_CONFIG = {
    "svn_fs_format": 6,
    "svn_compatible_version": "1.6",
    "svn_ignore_list": [
        ".misc",
        ".venv",
        "__pycache__",
        ".build_output_dir",
        ".config",
        ".svn_temp_import",
    ],
    "repo_name": ".misc/.svn_repo",
    "auto_commit_on_init": True  # 创建仓库后自动提交所有现有文件
}

def remove_readonly(func, path, excinfo):
    """处理只读文件的删除（用于shutil.rmtree的onerror参数）"""
    # 移除只读属性
    os.chmod(path, stat.S_IWRITE)
    # 重试删除
    func(path)

def force_remove_tree(path):
    """强制删除目录树（处理只读文件）"""
    if not os.path.exists(path):
        return True, '目录不存在'
    
    try:
        shutil.rmtree(path, onerror=remove_readonly)
        return True, f'已删除: {path}'
    except PermissionError as e:
        # 权限错误的特殊处理
        return False, (
            f'权限错误: {e}\n'
            f'请尝试以下解决方案:\n'
            f'  1. 以管理员权限运行此脚本\n'
            f'  2. 关闭所有可能使用该目录的程序\n'
            f'  3. 手动删除目录: {path}'
        )
    except Exception as e:
        return False, f'删除失败: {e}'

def ensure_svn():
    """确保svn命令可用,类似于0_venv.py的ensure_virtualenv"""
    try:
        result = subprocess.run(
            ['svn', '--version'],
            capture_output=True,
            text=True,
            check=False
        )
        if result.returncode == 0:
            # 提取版本号
            version_line = result.stdout.split('\n')[0]
            return True, f'SVN已安装: {version_line}'
        else:
            return False, 'SVN命令执行失败'
    except FileNotFoundError:
        return False, 'SVN未安装,请先安装Subversion'
    except Exception as e:
        return False, f'SVN检测失败: {e}'

def ensure_svnadmin():
    """确保svnadmin命令可用"""
    try:
        result = subprocess.run(
            ['svnadmin', '--version'],
            capture_output=True,
            text=True,
            check=False
        )
        if result.returncode == 0:
            return True, ''
        else:
            return False, 'svnadmin命令执行失败'
    except FileNotFoundError:
        return False, 'svnadmin未找到,请确认Subversion安装完整'
    except Exception as e:
        return False, f'svnadmin检测失败: {e}'

def load_config(config_path=None):
    """读取配置文件,确保所有必需参数存在"""
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

def run_cmd(cmd, cwd=None, silent=False):
    """运行命令并打印"""
    if not silent:
        print(f'>>> {cmd}', flush=True)
    try:
        subprocess.run(cmd, shell=True, check=True, cwd=cwd, 
                      stdout=subprocess.DEVNULL if silent else None,
                      stderr=subprocess.DEVNULL if silent else None)
        return True, ''
    except subprocess.CalledProcessError as e:
        return False, f'命令执行失败: {cmd}\n错误: {e}'
    except Exception as e:
        return False, f'命令执行异常: {e}'

def set_svn_ignore(work_path, ignore_list):
    """设置SVN忽略列表"""
    ignore_str = "\n".join(ignore_list)
    ignore_file = os.path.join(work_path, ".svnignore_temp")
    
    try:
        with open(ignore_file, "w", encoding="utf-8") as f:
            f.write(ignore_str)
        
        ok, msg = run_cmd(f'svn propset svn:ignore -F "{ignore_file}" .', cwd=work_path)
        
        # 删除临时文件
        if os.path.exists(ignore_file):
            os.remove(ignore_file)
        
        if not ok:
            return False, msg
        
        # 提交ignore设置
        ok, msg = run_cmd('svn commit -m "设置svn:ignore"', cwd=work_path)
        if not ok:
            return False, msg
        
        return True, 'SVN忽略列表设置成功'
    except Exception as e:
        # 清理临时文件
        if os.path.exists(ignore_file):
            os.remove(ignore_file)
        return False, f'设置svn:ignore失败: {e}'

def auto_commit_existing_files(work_path):
    """
    自动添加并提交工作目录中的所有现有文件
    
    Args:
        work_path: 工作目录路径
    
    Returns:
        (ok, msg)
    """
    try:
        # 使用 svn status 获取未版本化的文件列表（会自动排除 svn:ignore 中的文件）
        # "?" 开头的表示未版本化的文件
        result_status = subprocess.run(
            'svn status',
            shell=True,
            cwd=work_path,
            capture_output=True,
            text=True,
            check=False
        )
        
        # 收集需要添加的文件/目录
        files_to_add = []
        if result_status.stdout:
            for line in result_status.stdout.split('\n'):
                line = line.strip()
                if line.startswith('?'):
                    # 提取文件路径（去掉开头的 "?" 和空格）
                    file_path = line[1:].strip()
                    if file_path:
                        files_to_add.append(file_path)
        
        if not files_to_add:
            return True, '没有需要添加的文件（所有文件可能已在忽略列表中）'
        
        print(f'  正在添加 {len(files_to_add)} 个文件/目录...')
        
        # 批量添加文件（使用 --force 递归添加目录）
        # 使用引号包裹每个路径，避免空格问题
        for file_path in files_to_add:
            result = subprocess.run(
                f'svn add "{file_path}" --force',
                shell=True,
                cwd=work_path,
                capture_output=True,
                text=True,
                check=False
            )
            # 忽略已经添加的文件的警告
            if result.returncode != 0 and result.stderr and 'already under version control' not in result.stderr:
                print(f'警告: 添加 {file_path} 失败: {result.stderr}')
        
        # 提交这些文件（使用静默模式减少输出）
        ok, msg = run_cmd('svn commit -m "初始提交：添加现有文件" --quiet', cwd=work_path)
        if not ok:
            return False, f'提交失败: {msg}'
        
        return True, f'已自动提交 {len(files_to_add)} 个文件/目录'
        
    except Exception as e:
        return False, f'自动提交失败: {e}'

def clean_svn(base_path, config, silent=False):
    """
    清理SVN工作副本和远程仓库
    
    Args:
        base_path: 基础路径
        config: 配置字典
        silent: 是否静默模式（减少输出）
    
    Returns:
        (ok, msg)
    """
    repo_name = config.get('repo_name', '.svn_repo')
    repo_path = os.path.join(base_path, repo_name)
    work_svn_path = os.path.join(base_path, ".svn")
    
    if not silent:
        print('清理模式：删除SVN工作副本和远程仓库...')
    
    deleted_items = []
    failed_items = []
    
    # 删除工作副本 .svn
    if os.path.exists(work_svn_path):
        print(f'正在删除工作副本: {work_svn_path}')
        ok, msg = force_remove_tree(work_svn_path)
        if ok:
            print(f'✓ {msg}')
            deleted_items.append('.svn')
        else:
            print(f'✗ {msg}')
            failed_items.append(('.svn', msg))
    else:
        print(f'工作副本不存在: {work_svn_path}')
    
    # 删除远程仓库
    if os.path.exists(repo_path):
        print(f'正在删除远程仓库: {repo_path}')
        ok, msg = force_remove_tree(repo_path)
        if ok:
            print(f'✓ {msg}')
            deleted_items.append(repo_name)
        else:
            print(f'✗ {msg}')
            failed_items.append((repo_name, msg))
    else:
        print(f'远程仓库不存在: {repo_path}')
    
    # 返回结果
    if failed_items:
        error_msg = '清理失败:\n'
        for item, err in failed_items:
            error_msg += f'  - {item}: {err}\n'
        return False, error_msg
    
    if deleted_items:
        return True, f'清理完成，已删除: {", ".join(deleted_items)}'
    else:
        return True, '没有需要清理的内容'

def create_svn_repo(base_path, config):
    """
    在指定路径创建SVN仓库并检出
    
    Args:
        base_path: 基础路径（仓库和工作副本的位置）
        config: 配置字典
    
    Returns:
        (ok, msg)
    """
    repo_name = config.get('repo_name', '.svn_repo')
    svn_compatible_version = config.get('svn_compatible_version', '1.6')
    svn_ignore_list = config.get('svn_ignore_list', [])
    
    base_path = os.path.abspath(base_path)
    repo_path = os.path.join(base_path, repo_name)
    work_svn_path = os.path.join(base_path, ".svn")
    
    # 检查仓库是否已存在
    if os.path.exists(repo_path):
        return False, f'仓库目录已存在: {repo_path}\n使用 --recover 参数重建'
    
    if os.path.exists(work_svn_path):
        return False, f'工作副本已存在: {work_svn_path}\n使用 --recover 参数重建'
    
    print(f'\n正在创建SVN仓库: {repo_path}')
    
    # 确保仓库的父目录存在（如果repo_name包含子目录，如 .misc/.svn_repo）
    repo_parent = os.path.dirname(repo_path)
    if repo_parent and repo_parent != base_path:
        os.makedirs(repo_parent, exist_ok=True)
        print(f'已创建父目录: {repo_parent}')
    
    # 1. 创建中心仓库（指定兼容版本）
    # 注意：svnadmin create 要求目标目录不存在或为空
    print(f'创建SVN中心仓库（兼容版本: {svn_compatible_version}）...')
    ok, msg = run_cmd(
        f'svnadmin create --compatible-version={svn_compatible_version} "{repo_path}"',
        cwd=base_path
    )
    if not ok:
        return False, msg
    
    # 2. 创建临时目录结构用于导入
    # 在仓库外部创建临时目录，避免冲突
    temp_base = os.path.join(base_path, ".svn_temp_import")
    trunk_path = os.path.join(temp_base, "trunk")
    branches_path = os.path.join(temp_base, "branches")
    tags_path = os.path.join(temp_base, "tags")
    
    try:
        os.makedirs(trunk_path, exist_ok=True)
        os.makedirs(branches_path, exist_ok=True)
        os.makedirs(tags_path, exist_ok=True)
    except Exception as e:
        return False, f'创建临时目录结构失败: {e}'
    
    # 3. 构造仓库URL
    repo_url = f"file:///{repo_path.replace(os.sep, '/')}"
    print(f'仓库URL: {repo_url}')
    
    # 4. 导入初始结构
    print('导入初始目录结构（trunk/branches/tags）...')
    ok, msg = run_cmd(
        f'svn import "{temp_base}" "{repo_url}" -m "初始化仓库结构"',
        cwd=base_path
    )
    
    # 删除临时目录（无论成功失败都删除）
    if os.path.exists(temp_base):
        ok_del, msg_del = force_remove_tree(temp_base)
        if ok_del:
            print(f'已清理临时目录')
        else:
            print(f'警告: 删除临时目录失败: {msg_del}')
    
    if not ok:
        return False, msg
    
    # 5. 检出trunk到当前目录
    trunk_url = f"{repo_url}/trunk"
    print(f'\n检出trunk到当前目录: {base_path}')
    ok, msg = run_cmd(
        f'svn checkout "{trunk_url}" "{base_path}"',
        cwd=base_path
    )
    if not ok:
        return False, msg
    
    # 6. 设置svn:ignore（将仓库目录本身也加入忽略列表）
    print('\n设置SVN忽略列表...')
    full_ignore_list = list(svn_ignore_list)
    if repo_name not in full_ignore_list:
        full_ignore_list.append(repo_name)
    
    ok, msg = set_svn_ignore(base_path, full_ignore_list)
    if not ok:
        print(f'警告: {msg}')
        # 不返回失败，因为仓库已经创建成功
    
    # 7. 自动提交现有文件（如果开关打开）
    auto_commit = config.get('auto_commit_on_init', True)
    if auto_commit:
        print('\n自动提交现有文件...')
        ok_commit, msg_commit = auto_commit_existing_files(base_path)
        if ok_commit:
            print(f'✓ {msg_commit}')
        else:
            print(f'警告: {msg_commit}')
            # 不返回失败，因为仓库已经创建成功
    
    return True, f'SVN仓库创建成功！\n仓库路径: {repo_path}\n工作副本: {base_path}'

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='SVN仓库创建工具')
    parser.add_argument('--path', type=str, default=os.getcwd(), help='创建仓库的路径（默认当前目录）')
    parser.add_argument('--repo', type=str, default=None, help='仓库目录名（默认从配置文件读取）')
    parser.add_argument('--recover', action='store_true', help='重建模式（删除现有仓库和工作副本并重新创建）')
    parser.add_argument('--clean', action='store_true', help='清理模式（删除工作副本.svn和远程仓库）')
    parser.add_argument('--config', type=str, default=CONFIG_FILE, help=f'配置文件路径（默认: {CONFIG_FILE}）')
    args = parser.parse_args()
    
    # clean 和 recover 不能同时使用
    if args.clean and args.recover:
        print('错误: --clean 和 --recover 不能同时使用')
        sys.exit(1)
    
    # 1. 确保SVN已安装
    ok, msg = ensure_svn()
    if not ok:
        print(f'错误: {msg}')
        print('\n请安装Subversion，并将bin目录添加到系统环境变量PATH中:')
        print('  Windows: https://tortoisesvn.net/ 或使用 scoop install svn')
        print('  Linux:   sudo apt-get install subversion')
        print('  macOS:   brew install svn')
        sys.exit(1)
    print(msg)
    
    ok, msg = ensure_svnadmin()
    if not ok:
        print(f'错误: {msg}')
        sys.exit(1)
    
    # 2. 读取配置文件
    config = load_config(args.config)
    
    # 3. 命令行参数覆盖配置
    if args.repo:
        config['repo_name'] = args.repo
    
    print(f'\n目标路径: {os.path.abspath(args.path)}')
    print(f'仓库名称: {config["repo_name"]}')
    
    # 4. 处理清理模式
    if args.clean:
        confirm = input('\n警告: 清理模式将删除工作副本(.svn)和远程仓库！确认继续? (yes/no): ')
        if confirm.lower() not in ['yes', 'y']:
            print('已取消操作')
            sys.exit(0)
        
        ok, msg = clean_svn(args.path, config)
        
        print('\n' + '=' * 60)
        if ok:
            print('✓ ' + msg)
        else:
            print('✗ ' + msg)
            sys.exit(1)
        
        sys.exit(0)
    
    # 5. 处理重建模式（先清理，再创建）
    if args.recover:
        confirm = input('\n警告: 重建模式将删除现有仓库和工作副本！确认继续? (yes/no): ')
        if confirm.lower() not in ['yes', 'y']:
            print('已取消操作')
            sys.exit(0)
        
        # 先清理（使用 clean_svn 函数，避免代码重复）
        print('\n重建模式：')
        print('第一步: 清理现有仓库和工作副本...')
        ok_clean, msg_clean = clean_svn(args.path, config, silent=True)
        if not ok_clean:
            print(f'✗ 清理失败: {msg_clean}')
            sys.exit(1)
        print(f'  ✓ {msg_clean}')
        
        # 再创建
        print('\n第二步: 创建新的SVN仓库')
    
    # 6. 创建SVN仓库
    ok, msg = create_svn_repo(args.path, config)
    
    print('\n' + '=' * 60)
    if ok:
        print('✓ ' + msg)
        print('\n后续操作:')
        print('  1. 添加文件: svn add 文件名')
        print('  2. 提交更改: svn commit -m "提交说明"')
        print('  3. 查看状态: svn status')
        print('  4. 更新代码: svn update')
    else:
        print('✗ ' + msg)
        sys.exit(1)

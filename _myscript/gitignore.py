"""
创建或更新 .gitignore 文件

使用方法：
    python myscript/gitignore.py                    # 创建/更新 .gitignore
    python myscript/gitignore.py --check            # 检查 .gitignore 是否存在
    python myscript/gitignore.py --show             # 显示将要添加的规则
    python myscript/gitignore.py --reset            # 重置 .gitignore 为默认配置

功能：
    1. 自动创建标准的 Python 项目 .gitignore 文件
    2. 智能合并现有 .gitignore，不会重复添加规则
    3. 支持从 .config/myenv.json 读取忽略配置
    4. 包含常见的 Python、IDE、系统文件忽略规则
"""

import os
import sys
import argparse
import json
from pathlib import Path

# 项目根目录（假设脚本在 myscript/ 目录下）
PROJECT_ROOT = Path(__file__).parent.parent
GITIGNORE_PATH = PROJECT_ROOT / '.gitignore'
CONFIG_PATH = PROJECT_ROOT / '.config' / 'myenv.json'

# 默认忽略规则（分类组织）
DEFAULT_IGNORE_RULES = {
    '# Python 虚拟环境': [
        '.venv/',
    ],
    
    '# Python 编译文件': [
        '*.pyc',
        '*.pyo',
        '*.pyd',
        '__pycache__/',
        '*.so',
        '*.egg',
        '*.egg-info/',
        'build/',
        '.eggs/',
    ],
    
    '# 构建输出目录': [
        '.build/'
    ],
    
    '# PyInstaller': [
        '*.spec',
        '*.manifest',
    ],
    
    '# Jupyter Notebook': [
        '.ipynb_checkpoints/',
        '*.ipynb_checkpoints',
    ],
    
    '# 测试覆盖率': [
        'htmlcov/',
        '.coverage',
        '.coverage.*',
        '.pytest_cache/',
        '.tox/',
    ],
    
    '# IDE 配置': [
        '.vscode/',
        '.idea/',
        '*.swp',
        '*.swo',
        '*~',
        '.DS_Store',
    ],
    
    '# 文档临时文件': [
        '~$*.doc*',
        '~$*.xls*',
        '~$*.ppt*',
    ],
}


def load_config_ignores():
    """从配置文件加载忽略规则"""
    try:
        if CONFIG_PATH.exists():
            with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                config = json.load(f)
                folders = config.get('import_ignore_folder', [])
                files = config.get('import_ignore_file', [])
                return folders, files
    except Exception as e:
        print(f'警告: 读取配置文件失败: {e}')
    return [], []


def parse_gitignore(content):
    """解析 .gitignore 文件内容，返回规则集合"""
    rules = set()
    for line in content.split('\n'):
        line = line.strip()
        # 忽略空行和注释行
        if line and not line.startswith('#'):
            rules.add(line)
    return rules


def format_gitignore_content():
    """生成格式化的 .gitignore 内容"""
    lines = []
    lines.append('# ============================================')
    lines.append('# Python 项目 .gitignore')
    lines.append('# 自动生成，请勿手动删除分类注释')
    lines.append('# ============================================')
    lines.append('')
    
    # 添加默认规则
    for category, rules in DEFAULT_IGNORE_RULES.items():
        lines.append(category)
        for rule in rules:
            lines.append(rule)
        lines.append('')
    
    # 从配置文件添加额外规则
    config_folders, config_files = load_config_ignores()
    if config_folders or config_files:
        lines.append('# 从配置文件添加的规则')
        for folder in config_folders:
            # 确保文件夹规则以 / 结尾
            rule = folder if folder.endswith('/') else f'{folder}/'
            lines.append(rule)
        for file in config_files:
            lines.append(file)
        lines.append('')
    
    return '\n'.join(lines)


def merge_gitignore(existing_content, new_content):
    """智能合并现有和新的 .gitignore 内容"""
    existing_rules = parse_gitignore(existing_content)
    new_rules = parse_gitignore(new_content)
    
    # 找出需要添加的新规则
    rules_to_add = new_rules - existing_rules
    
    if not rules_to_add:
        return existing_content, 0
    
    # 在现有内容末尾添加新规则
    lines = [existing_content.rstrip()]
    lines.append('')
    lines.append('# ============================================')
    lines.append('# 自动添加的忽略规则')
    lines.append('# ============================================')
    for rule in sorted(rules_to_add):
        lines.append(rule)
    lines.append('')
    
    return '\n'.join(lines), len(rules_to_add)


def create_gitignore(force_reset=False):
    """创建或更新 .gitignore 文件"""
    new_content = format_gitignore_content()
    
    if GITIGNORE_PATH.exists() and not force_reset:
        # 读取现有内容
        with open(GITIGNORE_PATH, 'r', encoding='utf-8') as f:
            existing_content = f.read()
        
        # 智能合并
        merged_content, added_count = merge_gitignore(existing_content, new_content)
        
        if added_count == 0:
            return True, '.gitignore 已是最新，无需更新'
        
        # 写入合并后的内容
        with open(GITIGNORE_PATH, 'w', encoding='utf-8') as f:
            f.write(merged_content)
        
        return True, f'.gitignore 已更新，新增 {added_count} 条规则'
    else:
        # 创建新文件或重置
        with open(GITIGNORE_PATH, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        action = '重置' if force_reset else '创建'
        return True, f'.gitignore 文件已{action}成功'


def check_gitignore():
    """检查 .gitignore 是否存在"""
    if GITIGNORE_PATH.exists():
        with open(GITIGNORE_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
        rules = parse_gitignore(content)
        return True, f'.gitignore 存在，包含 {len(rules)} 条规则'
    else:
        return False, '.gitignore 不存在'


def show_rules():
    """显示将要添加的规则"""
    content = format_gitignore_content()
    print('=' * 60)
    print('将要添加到 .gitignore 的规则：')
    print('=' * 60)
    print(content)
    print('=' * 60)
    rules = parse_gitignore(content)
    print(f'\n总计: {len(rules)} 条规则')


def main():
    parser = argparse.ArgumentParser(description='.gitignore 管理工具')
    parser.add_argument('--check', action='store_true', help='检查 .gitignore 是否存在')
    parser.add_argument('--show', action='store_true', help='显示将要添加的规则（不实际创建）')
    parser.add_argument('--reset', action='store_true', help='重置 .gitignore 为默认配置（覆盖现有文件）')
    
    args = parser.parse_args()
    
    if args.check:
        ok, msg = check_gitignore()
        print(msg)
        sys.exit(0 if ok else 1)
    
    elif args.show:
        show_rules()
        sys.exit(0)
    
    elif args.reset:
        ok, msg = create_gitignore(force_reset=True)
        print(msg)
        sys.exit(0 if ok else 1)
    
    else:
        # 默认：创建或更新 .gitignore
        ok, msg = create_gitignore()
        print(msg)
        sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
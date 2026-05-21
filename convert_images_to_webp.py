#!/usr/bin/env python3
"""
批量将图片转换为 WebP 格式
支持递归扫描目录，自动转换 jpg, jpeg, png, gif 为 webp
"""

import os
import sys
from pathlib import Path
from PIL import Image
import argparse

def convert_to_webp(input_path, output_path=None, quality=85, lossless=False):
    """
    将图片转换为 WebP 格式
    
    Args:
        input_path: 输入图片路径
        output_path: 输出路径（可选，默认同目录同名.webp）
        quality: 压缩质量 (0-100)，默认 85
        lossless: 是否使用无损压缩
    
    Returns:
        成功返回输出路径，失败返回 None
    """
    try:
        img = Image.open(input_path)
        
        # 如果是 RGBA 模式，保持透明度
        if img.mode in ('RGBA', 'LA', 'P'):
            img = img.convert('RGBA')
        else:
            img = img.convert('RGB')
        
        # 确定输出路径
        if output_path is None:
            output_path = str(Path(input_path).with_suffix('.webp'))
        
        # 保存为 WebP
        save_kwargs = {
            'format': 'WEBP',
            'method': 6  # 压缩方法 (0-6, 6 最慢但压缩率最高)
        }
        
        if lossless:
            save_kwargs['lossless'] = True
        else:
            save_kwargs['quality'] = quality
        
        img.save(output_path, **save_kwargs)
        
        # 比较文件大小
        original_size = os.path.getsize(input_path)
        webp_size = os.path.getsize(output_path)
        saved = original_size - webp_size
        saved_percent = (saved / original_size * 100) if original_size > 0 else 0
        
        return {
            'success': True,
            'output': output_path,
            'original_size': original_size,
            'webp_size': webp_size,
            'saved': saved,
            'saved_percent': saved_percent
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def scan_and_convert(directory, recursive=True, quality=85, lossless=False, 
                    dry_run=False, skip_existing=True):
    """
    扫描目录并转换图片
    
    Args:
        directory: 要扫描的目录
        recursive: 是否递归扫描子目录
        quality: 压缩质量
        lossless: 是否使用无损压缩
        dry_run: 是否只显示将要转换的文件，不实际转换
        skip_existing: 如果 WebP 文件已存在，是否跳过
    """
    directory = Path(directory)
    if not directory.exists():
        print(f"❌ 目录不存在: {directory}")
        return
    
    # 支持的图片格式
    supported_formats = {'.jpg', '.jpeg', '.png', '.gif'}
    
    # 收集所有图片文件
    image_files = []
    pattern = '**/*' if recursive else '*'
    
    for ext in supported_formats:
        for img_file in directory.glob(f'{pattern}{ext}'):
            # 跳过已经是 webp 的文件
            if img_file.suffix.lower() == '.webp':
                continue
            image_files.append(img_file)
    
    if not image_files:
        print(f"📭 在 {directory} 中未找到可转换的图片文件")
        return
    
    print(f"📸 找到 {len(image_files)} 个图片文件")
    if dry_run:
        print("🔍 预览模式（不会实际转换）\n")
    else:
        print(f"⚙️  质量: {quality}, 无损: {lossless}\n")
    
    # 转换统计
    stats = {
        'total': len(image_files),
        'converted': 0,
        'skipped': 0,
        'failed': 0,
        'total_original_size': 0,
        'total_webp_size': 0
    }
    
    # 转换每个文件
    for img_file in image_files:
        webp_file = img_file.with_suffix('.webp')
        
        # 检查是否已存在
        if skip_existing and webp_file.exists():
            print(f"⏭️  跳过（已存在）: {img_file.name} → {webp_file.name}")
            stats['skipped'] += 1
            continue
        
        if dry_run:
            print(f"📄 将转换: {img_file}")
            stats['converted'] += 1
            continue
        
        print(f"🔄 转换中: {img_file.name}...", end=' ', flush=True)
        result = convert_to_webp(img_file, webp_file, quality, lossless)
        
        if result['success']:
            stats['converted'] += 1
            stats['total_original_size'] += result['original_size']
            stats['total_webp_size'] += result['webp_size']
            
            saved_mb = result['saved'] / (1024 * 1024)
            print(f"✅ 完成 (节省 {result['saved_percent']:.1f}%, {saved_mb:.2f}MB)")
        else:
            stats['failed'] += 1
            print(f"❌ 失败: {result['error']}")
    
    # 打印统计信息
    print("\n" + "="*60)
    print("📊 转换统计:")
    print(f"   总计: {stats['total']} 个文件")
    print(f"   成功: {stats['converted']} 个")
    print(f"   跳过: {stats['skipped']} 个")
    print(f"   失败: {stats['failed']} 个")
    
    if stats['converted'] > 0:
        total_saved = stats['total_original_size'] - stats['total_webp_size']
        total_saved_mb = total_saved / (1024 * 1024)
        total_saved_percent = (total_saved / stats['total_original_size'] * 100) if stats['total_original_size'] > 0 else 0
        print(f"\n💾 空间节省:")
        print(f"   原始大小: {stats['total_original_size'] / (1024 * 1024):.2f} MB")
        print(f"   WebP 大小: {stats['total_webp_size'] / (1024 * 1024):.2f} MB")
        print(f"   节省: {total_saved_mb:.2f} MB ({total_saved_percent:.1f}%)")

def main():
    parser = argparse.ArgumentParser(
        description='批量将图片转换为 WebP 格式',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 转换当前目录下的所有图片
  python convert_images_to_webp.py .
  
  # 转换指定目录（递归）
  python convert_images_to_webp.py assets/articles/images
  
  # 使用高质量（90）转换
  python convert_images_to_webp.py . --quality 90
  
  # 使用无损压缩
  python convert_images_to_webp.py . --lossless
  
  # 预览模式（不实际转换）
  python convert_images_to_webp.py . --dry-run
  
  # 强制重新转换（即使 WebP 已存在）
  python convert_images_to_webp.py . --force
        """
    )
    
    parser.add_argument(
        'directory',
        type=str,
        help='要转换的目录路径'
    )
    
    parser.add_argument(
        '--quality', '-q',
        type=int,
        default=85,
        choices=range(0, 101),
        metavar='0-100',
        help='压缩质量 (0-100，默认 85)'
    )
    
    parser.add_argument(
        '--lossless',
        action='store_true',
        help='使用无损压缩（文件更大但质量完美）'
    )
    
    parser.add_argument(
        '--no-recursive', '-n',
        action='store_true',
        help='不递归扫描子目录'
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='预览模式，只显示将要转换的文件，不实际转换'
    )
    
    parser.add_argument(
        '--force',
        action='store_true',
        help='强制重新转换，即使 WebP 文件已存在'
    )
    
    args = parser.parse_args()
    
    # 检查 PIL/Pillow 是否安装
    try:
        from PIL import Image
    except ImportError:
        print("❌ 错误: 需要安装 Pillow 库")
        print("   请运行: pip install Pillow")
        sys.exit(1)
    
    # 执行转换
    scan_and_convert(
        directory=args.directory,
        recursive=not args.no_recursive,
        quality=args.quality,
        lossless=args.lossless,
        dry_run=args.dry_run,
        skip_existing=not args.force
    )

if __name__ == '__main__':
    main()


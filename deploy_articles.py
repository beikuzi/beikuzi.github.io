#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
文章部署脚本

将 article/md 和 article/md_mod 合并部署到 assets/articles
同时将 docs/ 同步到 assets/docs/

用法:
    python deploy_articles.py
    python deploy_articles.py --input-md article/md --input-mod article/md_mod --output assets/articles
    python deploy_articles.py --no-docs  # 不同步 docs 目录

逻辑:
    1. 清空输出目录（可选）
    2. 复制 input-md/*.md → output/
    3. 复制 input-md/images/ → output/images/
    4. 如果 input-mod/ 有同名 .md 文件，覆盖到 output/
    5. 同步 docs/ → assets/docs/
"""

import argparse
import shutil
from pathlib import Path


def deploy_articles(
    input_md: Path,
    input_mod: Path,
    output: Path,
    clean: bool = False,
    verbose: bool = True
):
    """
    部署文章到输出目录
    
    Args:
        input_md: MD 源目录 (转换后的 markdown)
        input_mod: MD 修改目录 (手动修改的 markdown)
        output: 输出目录
        clean: 是否清空输出目录
        verbose: 是否打印详细信息
    """
    
    def log(msg):
        if verbose:
            print(msg)
    
    # 确保输入目录存在
    if not input_md.exists():
        print(f"❌ 错误: 输入目录不存在: {input_md}")
        return False
    
    # 清空或创建输出目录
    if clean and output.exists():
        log(f"🗑️  清空输出目录: {output}")
        shutil.rmtree(output)
    
    output.mkdir(parents=True, exist_ok=True)
    
    # 统计
    stats = {
        "md_copied": 0,
        "md_overwritten": 0,
        "images_copied": 0,
    }
    
    # 1. 复制 input-md/*.md 到 output/
    log(f"\n📄 复制 MD 文件从: {input_md}")
    for md_file in input_md.glob("*.md"):
        dest = output / md_file.name
        shutil.copy2(md_file, dest)
        log(f"   ✓ {md_file.name}")
        stats["md_copied"] += 1
    
    # 2. 复制 input-md/images/ 到 output/images/
    images_src = input_md / "images"
    if images_src.exists():
        images_dest = output / "images"
        log(f"\n🖼️  复制图片目录: {images_src}")
        
        if images_dest.exists():
            shutil.rmtree(images_dest)
        
        shutil.copytree(images_src, images_dest)
        
        # 统计图片数量
        for img in images_dest.rglob("*"):
            if img.is_file():
                stats["images_copied"] += 1
        
        log(f"   ✓ 复制了 {stats['images_copied']} 个图片文件")
    
    # 3. 如果 input-mod/ 有同名 .md 文件，覆盖到 output/
    if input_mod.exists():
        log(f"\n📝 检查修改目录: {input_mod}")
        for mod_file in input_mod.glob("*.md"):
            dest = output / mod_file.name
            if dest.exists():
                log(f"   ⚡ 覆盖: {mod_file.name}")
                stats["md_overwritten"] += 1
            else:
                log(f"   ➕ 新增: {mod_file.name}")
                stats["md_copied"] += 1
            shutil.copy2(mod_file, dest)
    else:
        log(f"\n📝 修改目录不存在，跳过: {input_mod}")
    
    # 打印统计
    log(f"\n✅ 部署完成!")
    log(f"   📄 MD 文件: {stats['md_copied']} 个复制, {stats['md_overwritten']} 个覆盖")
    log(f"   🖼️  图片文件: {stats['images_copied']} 个")
    log(f"   📁 输出目录: {output.absolute()}")
    
    return True


def deploy_docs(
    docs_src: Path,
    docs_dest: Path,
    verbose: bool = True
):
    """
    同步 docs 目录到 assets/docs
    
    Args:
        docs_src: docs 源目录 (根目录的 docs/)
        docs_dest: docs 目标目录 (assets/docs/)
        verbose: 是否打印详细信息
    """
    
    def log(msg):
        if verbose:
            print(msg)
    
    # 确保源目录存在
    if not docs_src.exists():
        log(f"⚠️  警告: docs 源目录不存在: {docs_src}")
        return False
    
    # 统计
    stats = {
        "copied": 0,
        "updated": 0,
    }
    
    log(f"\n📚 同步 docs 目录: {docs_src} → {docs_dest}")
    
    # 确保目标目录存在
    docs_dest.mkdir(parents=True, exist_ok=True)
    
    # 遍历源目录中的所有文件
    for src_file in docs_src.rglob("*"):
        if src_file.is_file():
            # 计算相对路径
            rel_path = src_file.relative_to(docs_src)
            dest_file = docs_dest / rel_path
            
            # 确保目标文件的父目录存在
            dest_file.parent.mkdir(parents=True, exist_ok=True)
            
            # 检查是否需要更新
            if dest_file.exists():
                # 比较修改时间
                src_mtime = src_file.stat().st_mtime
                dest_mtime = dest_file.stat().st_mtime
                if src_mtime > dest_mtime:
                    shutil.copy2(src_file, dest_file)
                    log(f"   ⚡ 更新: {rel_path}")
                    stats["updated"] += 1
                else:
                    log(f"   ⏭️  跳过 (无变化): {rel_path}")
            else:
                shutil.copy2(src_file, dest_file)
                log(f"   ✓ 复制: {rel_path}")
                stats["copied"] += 1
    
    # 打印统计
    log(f"\n✅ docs 同步完成!")
    log(f"   📄 文件: {stats['copied']} 个复制, {stats['updated']} 个更新")
    log(f"   📁 输出目录: {docs_dest.absolute()}")
    
    return True


def main():
    parser = argparse.ArgumentParser(
        description="文章部署脚本 - 合并 md 和 md_mod 到输出目录，同步 docs 到 assets/docs",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
    python deploy_articles.py              # 部署文章 + 同步 docs
    python deploy_articles.py --clean      # 清空后重新部署
    python deploy_articles.py --no-docs    # 只部署文章，不同步 docs
    python deploy_articles.py --only-docs  # 只同步 docs，不部署文章
    python deploy_articles.py --input-md article/md --output assets/articles
        """
    )
    
    parser.add_argument(
        "--input-md",
        type=Path,
        default=Path("article/md"),
        help="MD 源目录 (默认: article/md)"
    )
    
    parser.add_argument(
        "--input-mod",
        type=Path,
        default=Path("article/md_mod"),
        help="MD 修改目录 (默认: article/md_mod)"
    )
    
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("assets/articles"),
        help="输出目录 (默认: assets/articles)"
    )
    
    parser.add_argument(
        "--clean",
        action="store_true",
        help="部署前清空输出目录"
    )
    
    parser.add_argument(
        "-q", "--quiet",
        action="store_true",
        help="静默模式，不打印详细信息"
    )
    
    parser.add_argument(
        "--docs-src",
        type=Path,
        default=Path("docs"),
        help="docs 源目录 (默认: docs)"
    )
    
    parser.add_argument(
        "--docs-dest",
        type=Path,
        default=Path("assets/docs"),
        help="docs 目标目录 (默认: assets/docs)"
    )
    
    parser.add_argument(
        "--no-docs",
        action="store_true",
        help="不同步 docs 目录"
    )
    
    parser.add_argument(
        "--only-docs",
        action="store_true",
        help="只同步 docs 目录，不部署文章"
    )
    
    args = parser.parse_args()
    
    verbose = not args.quiet
    success = True
    
    # 部署文章
    if not args.only_docs:
        success = deploy_articles(
            input_md=args.input_md,
            input_mod=args.input_mod,
            output=args.output,
            clean=args.clean,
            verbose=verbose
        )
    
    # 同步 docs
    if not args.no_docs:
        docs_success = deploy_docs(
            docs_src=args.docs_src,
            docs_dest=args.docs_dest,
            verbose=verbose
        )
        success = success and docs_success
    
    return 0 if success else 1


if __name__ == "__main__":
    exit(main())


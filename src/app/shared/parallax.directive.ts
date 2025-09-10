import { AfterViewInit, Directive, ElementRef, Input, OnDestroy } from '@angular/core';

@Directive({
  selector: '[parallaxImg]',
  standalone: true,
})
export class ParallaxImgDirective implements AfterViewInit, OnDestroy {
  @Input() speed = 0.35;  // 0.1–0.5
  @Input() max = 40;      // max posun v px na jednu stranu

  private onScroll = () => this.update();
  private onResize = () => this.update();

  constructor(private elRef: ElementRef<HTMLImageElement>) {}

  ngAfterViewInit(): void {
    const img = this.elRef.nativeElement;
    const wrap = img.parentElement as HTMLElement;

    // garantuj 290px wrapper
    Object.assign(wrap.style, { position:'relative', height:'290px', overflow:'hidden' });

    // obrázok väčší než wrapper o 2*max, aby mal “mäso” na posun
    Object.assign(img.style, {
      position: 'absolute',
      left: '0',
      top: `-${this.max}px`,
      width: '100%',
      height: `calc(100% + ${this.max * 2}px)`,
      objectFit: 'cover',
      willChange: 'transform',
      transform: 'translate3d(0,0,0)',
    });

    this.update();
    addEventListener('scroll', this.onScroll, { passive: true });
    addEventListener('resize', this.onResize);
  }

  ngOnDestroy(): void {
    removeEventListener('scroll', this.onScroll);
    removeEventListener('resize', this.onResize);
  }

  private update(): void {
    const img = this.elRef.nativeElement;
    const wrap = img.parentElement as HTMLElement;
    const rect = wrap.getBoundingClientRect();

    // vypočítaj posun a ohranič ho do ±max
    let t = -rect.top * this.speed;
    if (t >  this.max) t =  this.max;
    if (t < -this.max) t = -this.max;

    img.style.transform = `translate3d(0, ${t}px, 0)`;
  }
}

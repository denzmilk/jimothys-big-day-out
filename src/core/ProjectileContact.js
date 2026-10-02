// The near intersection matters: testing endpoints alone tunnels through giants.
export function segmentSphere(start,end,center,radius){
 const dx=end.x-start.x,dy=end.y-start.y,dz=end.z-start.z;
 const ox=start.x-center.x,oy=start.y-center.y,oz=start.z-center.z;
 const c=ox*ox+oy*oy+oz*oz-radius*radius;if(c<=0)return 0;
 const a=dx*dx+dy*dy+dz*dz;if(!a)return null;
 const b=ox*dx+oy*dy+oz*dz,d=b*b-a*c;if(d<0)return null;
 const t=(-b-Math.sqrt(d))/a;return t>=0&&t<=1?t:null;
}

import { Geometry } from "geojson";
import { Entity, BaseEntity, Column, PrimaryColumn } from "typeorm";

@Entity("mvt1")
export class MVT1 extends BaseEntity {
  @PrimaryColumn({ type: "smallint" })
  x: number;

  @PrimaryColumn({ type: "smallint" })
  y: number;

  @Column({ type: "geometry", spatialFeatureType: "GEOMETRY", srid: 4326 })
  geom: Geometry;
}

@Entity("mvt2")
export class MVT2 extends BaseEntity {
  @PrimaryColumn({ type: "smallint" })
  x: number;

  @PrimaryColumn({ type: "smallint" })
  y: number;

  @Column({ type: "geometry", spatialFeatureType: "GEOMETRY", srid: 4326 })
  geom: Geometry;
}

@Entity("mvt3")
export class MVT3 extends BaseEntity {
  @PrimaryColumn({ type: "smallint" })
  x: number;

  @PrimaryColumn({ type: "smallint" })
  y: number;

  @Column({ type: "geometry", spatialFeatureType: "GEOMETRY", srid: 4326 })
  geom: Geometry;
}
@Entity("mvt4")
export class MVT4 extends BaseEntity {
  @PrimaryColumn({ type: "smallint" })
  x: number;

  @PrimaryColumn({ type: "smallint" })
  y: number;

  @Column({ type: "geometry", spatialFeatureType: "GEOMETRY", srid: 4326 })
  geom: Geometry;
}
@Entity("mvt5")
export class MVT5 extends BaseEntity {
  @PrimaryColumn({ type: "smallint" })
  x: number;

  @PrimaryColumn({ type: "smallint" })
  y: number;

  @Column({ type: "geometry", spatialFeatureType: "GEOMETRY", srid: 4326 })
  geom: Geometry;
}
@Entity("mvt6")
export class MVT6 extends BaseEntity {
  @PrimaryColumn({ type: "smallint" })
  x: number;

  @PrimaryColumn({ type: "smallint" })
  y: number;

  @Column({ type: "geometry", spatialFeatureType: "GEOMETRY", srid: 4326 })
  geom: Geometry;
}

@Entity("mvt7")
export class MVT7 extends BaseEntity {
  @PrimaryColumn({ type: "smallint" })
  x: number;

  @PrimaryColumn({ type: "smallint" })
  y: number;

  @Column({ type: "geometry", spatialFeatureType: "GEOMETRY", srid: 4326 })
  geom: Geometry;
}

@Entity("mvt8")
export class MVT8 extends BaseEntity {
  @PrimaryColumn({ type: "smallint" })
  x: number;

  @PrimaryColumn({ type: "smallint" })
  y: number;

  @Column({ type: "geometry", spatialFeatureType: "GEOMETRY", srid: 4326 })
  geom: Geometry;
}

@Entity("mvt9")
export class MVT9 extends BaseEntity {
  @PrimaryColumn({ type: "smallint" })
  x: number;

  @PrimaryColumn({ type: "smallint" })
  y: number;

  @Column({ type: "geometry", spatialFeatureType: "GEOMETRY", srid: 4326 })
  geom: Geometry;
}

@Entity("mvt10")
export class MVT10 extends BaseEntity {
  @PrimaryColumn({ type: "smallint" })
  x: number;

  @PrimaryColumn({ type: "smallint" })
  y: number;

  @Column({ type: "geometry", spatialFeatureType: "GEOMETRY", srid: 4326 })
  geom: Geometry;
}

@Entity("mvt11")
export class MVT11 extends BaseEntity {
  @PrimaryColumn({ type: "smallint" })
  x: number;

  @PrimaryColumn({ type: "smallint" })
  y: number;

  @Column({ type: "geometry", spatialFeatureType: "GEOMETRY", srid: 4326 })
  geom: Geometry;
}

@Entity("mvt12")
export class MVT12 extends BaseEntity {
  @PrimaryColumn({ type: "smallint" })
  x: number;

  @PrimaryColumn({ type: "smallint" })
  y: number;

  @Column({ type: "geometry", spatialFeatureType: "GEOMETRY", srid: 4326 })
  geom: Geometry;
}
@Entity("mvt13")
export class MVT13 extends BaseEntity {
  @PrimaryColumn({ type: "smallint" })
  x: number;

  @PrimaryColumn({ type: "smallint" })
  y: number;

  @Column({ type: "geometry", spatialFeatureType: "GEOMETRY", srid: 4326 })
  geom: Geometry;
}

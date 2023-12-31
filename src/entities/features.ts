import {
  Entity,
  BaseEntity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
} from "typeorm";

import { Geometry } from "geojson";
import { Collections } from "src/entities/collections.js";

@Entity("features")
export class Features extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  feature_id: string;

  @ManyToOne((type) => Collections, {
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "ft_collection" })
  ft_collection: Collections;

  @Column({ type: "geometry", spatialFeatureType: "GEOMETRY", srid: 4326 })
  geom: Geometry;

  @Column({ type: "jsonb", nullable: true })
  properties: string;
}

@Entity("patch_features")
export class PatchFeatures extends BaseEntity {
  @PrimaryColumn("uuid")
  feature_id: string;

  @ManyToOne((type) => Collections, {
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "ft_collection" })
  ft_collection: Collections;

  @Column({ type: "geometry", spatialFeatureType: "GEOMETRY", srid: 4326 })
  geom: Geometry;

  @Column({ type: "jsonb", nullable: true })
  properties: string;
}

@Entity("tmp_features")
export class TmpFeatures extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  feature_id: string;

  @Column({
    type: "geometry",
    spatialFeatureType: "GEOMETRY",
    srid: 4326,
    nullable: true,
  })
  geom: Geometry;

  @Column({ type: "jsonb", nullable: true })
  properties: string;
}

import type { Schema, Struct } from '@strapi/strapi';

export interface ServiceProcedureStep extends Struct.ComponentSchema {
  collectionName: 'components_service_procedure_steps';
  info: {
    displayName: 'Procedure step';
  };
  attributes: {
    description: Schema.Attribute.Text;
    order: Schema.Attribute.Integer;
    title: Schema.Attribute.String;
  };
}

export interface ServiceRequiredDocument extends Struct.ComponentSchema {
  collectionName: 'components_service_required_documents';
  info: {
    displayName: 'Required document';
  };
  attributes: {
    description: Schema.Attribute.Text;
    name: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ServiceVerification extends Struct.ComponentSchema {
  collectionName: 'components_service_verifications';
  info: {
    displayName: 'Verification';
  };
  attributes: {
    sourceTitle: Schema.Attribute.String & Schema.Attribute.Required;
    sourceUrl: Schema.Attribute.String & Schema.Attribute.Required;
    verifiedAt: Schema.Attribute.Date & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'service.procedure-step': ServiceProcedureStep;
      'service.required-document': ServiceRequiredDocument;
      'service.verification': ServiceVerification;
    }
  }
}

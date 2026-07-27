<?php

namespace Modules\FormHub\Enums;

enum FieldType: string
{
    case Text = 'text';
    case Textarea = 'textarea';
    case Number = 'number';
    case Boolean = 'boolean';
    case Date = 'date';
    case Select = 'select';
    case Multiselect = 'multiselect';
    case Group = 'group';
    case PairedLr = 'paired_lr';
}

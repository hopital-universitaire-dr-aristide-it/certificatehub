<?php

namespace Modules\Import\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ImportUploadResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'tag' => $this->tag,
            'original_filename' => $this->original_filename,
            'uploaded_by_name' => $this->whenLoaded('uploadedBy', fn () => $this->uploadedBy?->name),
            'created_at' => $this->created_at,
            'completed_at' => $this->completed_at,
            'completed_by_name' => $this->whenLoaded('completedBy', fn () => $this->completedBy?->name),
        ];
    }
}
